import usermodel from "../../DB/models/usermodel.js";
import { AssistantModel } from "../../DB/models/assistant_model.js";
import { hash, compare } from "../../common/utilits/security/hash.js";
import * as db_service from "../../DB/db.service.js";
import { decrypt, encrypt } from "../../common/utilits/security/encrypt.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { providerenum, roleenum } from "../../common/enum/user.enum.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  access_secret_key,
  Prefix,
  refreshsecretkey,
} from "../../../config/config.service.js";
import {
  generatetoken,
  verifytoken,
} from "../../common/utilits/token.service.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import {
  block_otp_key,
  deleletekey,
  get,
  get_key,
  incr,
  keys,
  max_otp_key,
  otp_key,
  revokedkey,
  setvalue,
  ttl,
  expire,
} from "../../DB/redis/redis.service.js";
import patientmodel from "../../DB/models/patientmodel.js";
import {
  generateotp,
  sendemail,
} from "../../common/utilits/email/send email.js";
import { eventemitter } from "../../common/utilits/email/email.events.js";
import { emailenum } from "../../common/enum/emailenum.js";
import { emailtemplete } from "../../common/utilits/email/emai.templete.js";
import doctormodel from "../../DB/models/doctormodel.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import notificationmodel from "../../DB/models/notificationmodel.js";
import reviewmodel from "../../DB/models/reviewmodel.js";
import slotmodel from "../../DB/models/slot_model.js";
import availabilitymodel from "../../DB/models/avalibility_model.js";
import clinicmodel from "../../DB/models/clinic_model.js";
import DoctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import { notify } from "../notifications/notification.service.js";

const sendemailotp = async ({ email, subject } = {}) => {
  const isblocked = await ttl(block_otp_key({ email }));
  if (isblocked > 0) {
    throw new Error(
      `you already blocked  please try again  after ${isblocked} seconds`,
    );
  }
  const ttlotp = await ttl(otp_key({ email, subject }));

  if (ttlotp > 0) {
    throw new Error(
      `you already have otp not expired yet please try again after ${ttlotp} seconds`,
    );
  }

  if ((await get(max_otp_key({ email }))) >= 3) {
    await setvalue({
      key: block_otp_key({ email }),
      value: 1,
      ttl: 60 * 60 * 10,
    });

    await deleletekey(max_otp_key({ email }));

    throw new Error(`you exceed the maximmu number of trials`);
  }
  const otp = await generateotp();
  eventemitter.emit(emailenum.confirmemail, async () => {
    await sendemail({
      to: email,
      subject: "hello to Carehub app",
      html: emailtemplete(otp),
    });
    await setvalue({
      key: otp_key({ email, subject }),
      value: hash({ plain_text: `${otp}` }),
      ttl: 60 * 2,
    });

    const key = max_otp_key({ email });

    const count = await incr(key);

    if (count === 1) {
      await expire({
        key,
        ttl: 60 * 60, // ساعة
      });
    }
  });
};

export const confirmemail = async (req, res, next) => {
  const { email, code } = req.body;
  const otpvalue = await get(
    otp_key({ email, subject: emailenum.confirmemail }),
  );
  if (!otpvalue) {
    throw new Error("otp expired");
  }
  if (
    !compare({
      plain_text: code.trim(),
      cipher_text: otpvalue,
    })
  ) {
    throw new Error("invalid otp ");
  }
  const user = await db_service.findOneAndUpdate({
    model: usermodel,
    filter: {
      email,
      confirmed: { $exists: false },
      provider: providerenum.system,
    },
    update: { confirmed: true },
  });
  if (!user) {
    throw new Error("user not exist");
  }
  await deleletekey(otp_key({ email, subject: emailenum.confirmemail }));
  successresponse({ res, message: "email confirmed successfuly" });
};

export const resendotp = async (req, res, next) => {


  const { email } = req.body;

  // دور على اليوزر
  const user = await db_service.findOne({
    model: usermodel,
    filter: {
      email,
      provider: providerenum.system,
    }
  });

  if (!user) throw new Error("user not exist");

  // لو مريض — لازم يكون لسه مش confirmed
  if (user.role === "patient") {
    if (user.confirmed) throw new Error("email already confirmed");
  }

  // لو دكتور — لازم يكون اتعمله approve في الـ doctormodel
  if (user.role === "doctor") {
    if (user.status !== "approved") {
      throw new Error("doctor not approved yet");
    }
  }

  await sendemailotp({ email, subject: emailenum.confirmemail });
  successresponse({ res, message: "otp sent" });
}
export const refreshtoken = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) {
    throw new Error("token not exist");
  }
  const [prefix, token] = authorization.split(" ");
  if (prefix !== Prefix) {
    throw new Error("invalid token prefix");
  }
  const decoded = verifytoken({ token, secret_key: refreshsecretkey });
  if (!decoded || !decoded?.id) {
    throw new Error("invalid token ");
  }
  const user = await db_service.findOne({
    model: usermodel,
    filter: { _id: decoded.id },
  });
  if (!user) {
    throw new Error("user not exist", { cause: 400 });
  }
  res.json({ message: "done " });
};

export const resetPassword = async (req, res, next) => {
  const { email, code, newpassword } = req.body;
  const otpvalue = await get(
    otp_key({ email, subject: emailenum.forgetPassword }),
  );
  if (!otpvalue) {
    throw new Error("otp expire");
  }
  if (!compare({ plain_text: code, cipher_text: otpvalue })) {
    throw new Error("invalid otp");
  }
  const user = await db_service.findOneAndUpdate({
    model: usermodel,
    filter: {
      email,
      provider: providerenum.system,
      confirmed: { $exists: true },
    },
    update: {
      password: await hash({ plain_text: newpassword }),
      changecredential: new Date(),
    },
  });
  if (!user) {
    throw new Error("user not exist or invalid provider", { cause: 400 });
  }
  await deleletekey(otp_key({ email, subject: emailenum.forgetPassword }));

  /////to send email to user to inform them that their password has been reset successfully
  eventemitter.emit(emailenum.confirmemail, async () => {
    await sendemail({
      to: email,
      subject: "Password Reset Alert - CareHub",
      html: `
        <p>Your CareHub password was reset successfully.</p>
        <p>If you didn't do this, please contact support immediately.</p>
      `
    });
  });

  successresponse({ res, message: "success" });
};

export const forgetPassword = async (req, res, next) => {
  const { email } = req.body;

  const user = await db_service.findOne({
    model: usermodel,
    filter: {
      email,
      provider: providerenum.system,
      confirmed: { $exists: true },
    },
  });

  if (!user) {
    throw new Error("user not found", { cause: 400 });
  }
  await sendemailotp({ email, subject: emailenum.forgetPassword });

  successresponse({ res, message: "successs" });
};

export const UpdatePassword = async (req, res, next) => {
  const { oldpassword, newpassword, cpassword } = req.body;
  if (!compare({ plain_text: oldpassword, cipher_text: req.user.password })) {
    throw new Error("old password is wrong");
  }

  const hashed = hash({ plain_text: newpassword });
  req.user.password = hashed;
  req.user.changecredential = new Date();

  await req.user.save();

  successresponse({ res, message: "password updated" });
};

export const logout = async (req, res, next) => {
  const { flag } = req.query;
  if (flag === "all") {
    req.user.changecredential = new Date();
    await req.user.save();
    await deleletekey(await keys(get_key({ userid: req.user._id })));
  } else {
    await setvalue({
      key: revokedkey({ userid: req.user._id, jti: req.decoded.jti }),
      value: `${req.decoded.jti}`,
      ttl: req.decoded.exp - Math.floor(Date.now() / 1000),
    });
  }
  successresponse({ res });
};

export const signin = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await db_service.findOne({
    model: usermodel,
    filter: {
      email,
      provider: providerenum.system,
      //confirmed: { $exists: true }, //COMMITED TO EASILY USED IN TEST
    },
  });
  if (!user) {
    throw new Error("user not exist or invalid provider", { cause: 400 });
  }
  if (!compare({ plain_text: password, cipher_text: user.password })) {
    throw new Error("invalid password", { cause: 400 });
  }

  if (user.status === "blocked") {
    return next(
      new Error("Account is deactivated. Contact admin.", { cause: 403 }),
    );
  }


  // لو patient لازم يكون confirmed
  if (user.role === "patient" && !user.confirmed) {
    throw new Error("please confirm your email first", { cause: 403 });
  }

  // لو doctor لازم يكون approved
  if (user.role === "doctor") {
    if (user.status !== "approved") {
      throw new Error("doctor not approved yet");
    }
  }

  const uuid = uuidv4();
  const access_token = generatetoken({
    payload: { id: user._id, email: user.email },
    secret_key: access_secret_key,
    options: {
      expiresIn: "25h",

      jwtid: uuid,
    },
  });
  const refreshtoken = generatetoken({
    payload: {
      id: user._id,
      email: user.email,
    },
    secret_key: refreshsecretkey,
    options: {
      expiresIn: "20h",
      jwtid: uuid,
    },
  });
  console.log("REFRESH:", refreshtoken);

  let assistantData = null;
  let subscriptionPlan = null;
  
  if (user.role === roleenum.assistant) {
    assistantData = await AssistantModel.findOne({ userId: user._id })
      .populate('doctorId', 'fullName')
      .populate('clinicId', 'name');
  } else if (user.role === roleenum.doctor) {
    const doctor = await doctormodel.findOne({ userId: user._id }).lean();
    if (doctor) {
      const activeSubscription = await DoctorSubscriptionModel.findOne({
        doctorId: user._id,
        status: "active"
      }).populate('subscriptionId', 'name').lean();
      
      if (activeSubscription && activeSubscription.subscriptionId) {
        subscriptionPlan = activeSubscription.subscriptionId.name;
      } else {
        subscriptionPlan = "Free"; // Default if missing
      }
    }
  }

  successresponse({
    res,
    message: "success signin",
    data: {
      access_token,
      refreshtoken,
      email: user.email,
      role: user.role,
      id: user._id,
      fullName: user.fullName,
      profilepicture: user.profilepicture,
      ...(subscriptionPlan && { subscriptionPlan }),
      ...(assistantData && { 
          permissions: assistantData.permissions,
          doctorId: assistantData.doctorId?._id || assistantData.doctorId,
          jobTitle: assistantData.jobTitle,
          doctorName: assistantData.doctorId?.fullName,
          clinicId: assistantData.clinicId?._id || assistantData.clinicId,
          clinicName: assistantData.clinicId?.name
      })
    },
  });
};

export const signup = async (req, res, next) => {
  const {
    fullName,
    email,
    password,
    confirmPassword,
    phoneNumber,
    role,
    dateOfBirth,
    gender,
    governorate,
    address,
    bloodType,
    specialty,
    syndicateId,
    nationalId,
    experience,
  } = req.body;

  const existingUser = await db_service.findOne({
    model: usermodel,
    filter: { email },
  });

  if (existingUser) {
    if (existingUser.role === "doctor" && existingUser.status === "rejected") {
      const oldDoctor = await db_service.findOne({
        model: doctormodel,
        filter: { userId: existingUser._id },
      });
      if (oldDoctor) {
        if (oldDoctor.licenseimage?.public_id) {
          await cloudinary.uploader.destroy(oldDoctor.licenseimage.public_id).catch(() => null);
        }
        if (oldDoctor.nationalId?.public_id) {
          await cloudinary.uploader.destroy(oldDoctor.nationalId.public_id).catch(() => null);
        }
        await doctormodel.deleteOne({ _id: oldDoctor._id });
      }
      await usermodel.deleteOne({ _id: existingUser._id });
    } else {
      throw new Error("email already exists", { cause: 409 });
    }
  }

  if (password !== confirmPassword) {
    throw new Error("password mismatch");
  }

  if (!["doctor", "patient"].includes(role)) {
    throw new Error("invalid role");
  }

  let licenseImage = null;
  let nationalIdImage = null;

  try {
    if (role === "doctor") {
      if (!req.files?.licenseImage) {
        throw new Error("license image required");
      }

      const { secure_url, public_id } = await cloudinary.uploader.upload(
        req.files.licenseImage[0].path,
        { folder: "carehub/doctors" },
      );

      licenseImage = { secure_url, public_id };

      if (!req.files?.nationalId) {
        throw new Error("national id image required");
      }

      const { secure_url: national_secure_url, public_id: national_public_id } =
        await cloudinary.uploader.upload(req.files.nationalId[0].path, {
          folder: "carehub/nationalIds",
        });

      nationalIdImage = {
        secure_url: national_secure_url,
        public_id: national_public_id,
      };
    }

    const user = await db_service.create({
      model: usermodel,
      data: {
        fullName,
        email,
        password: hash({ plain_text: password }),
        phoneNumber: encrypt(phoneNumber),
        role,
        address,
      },
    });

    if (role === "doctor") {
      await db_service.create({
        model: doctormodel,
        data: {
          userId: user._id,
          specialization: specialty,
          nationalId: nationalIdImage,
          experience,
          syncdicatedId: syndicateId,
          licenseimage: licenseImage
        }
      });

      await notify.newDoctorUnderReview(user._id);

      const admins = await usermodel.find({ role: roleenum.admin }).select("_id");
      await Promise.all(
        admins.map((admin) => notify.newDoctorRegistration(admin._id, user.fullName))
      );

    } else {
      await db_service.create({
        model: patientmodel,
        data: {
          userId: user._id,
          dateOfBirth,
          gender,
          governorate,
          bloodType,
          address
        }
      });
    }

    // بعت OTP للمريض فقط
    if (role === "patient") {
      const otp = await generateotp();
      eventemitter.emit(emailenum.confirmemail, async () => {
        await sendemail({
          to: email,
          subject: "welcome to carehub",
          html: `<p>welcome to Carehub app your otp is: ${otp}</p>`
        });
        await setvalue({
          key: otp_key({ email, subject: emailenum.confirmemail }),
          value: hash({ plain_text: `${otp}` }),
          ttl: 60 * 2
        });
        await setvalue({
          key: max_otp_key({ email }),
          value: 1,
          ttl: 60 * 60
        });
      });
    }

    successresponse({
      res,
      status: 201,
      message: "signup success",
      data: user
    });

  } catch (error) {
    if (licenseImage?.public_id) {
      await cloudinary.uploader.destroy(licenseImage.public_id);
    }
    if (nationalIdImage?.public_id) {
      await cloudinary.uploader.destroy(nationalIdImage.public_id);
    }
    throw error;
  }
};
import { getPlanName, getActiveFeatures, getClinicLimit } from "../../common/utilits/subscription.guard.js";

export const getprofile = async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return next(new Error("User not found", { cause: 404 }));
  }

  let assistantData = null;
  let subscriptionPlan = "Free";
  let subscriptionFeatures = [];
  let clinicLimit = 0;
  
  if (user.role === roleenum.assistant) {
    assistantData = await AssistantModel.findOne({ userId: user._id })
      .populate('doctorId', 'fullName')
      .populate('clinicId', 'name');
      
    console.log("[getprofile] populated assistantData:", assistantData);
      
    if (assistantData && assistantData.isActive === false) {
      return next(new Error("Account suspended. Please contact your doctor.", { cause: 403 }));
    }
  } else if (user.role === roleenum.doctor) {
    const doctor = await doctormodel.findOne({ userId: user._id }).lean();
    if (doctor) {
        subscriptionPlan = await getPlanName(user._id);
        subscriptionFeatures = await getActiveFeatures(user._id);
        clinicLimit = await getClinicLimit(user._id);
    }
  }

  successresponse({
    res,
    message: "Profile fetched successfully",
    data: {
      email: user.email,
      role: user.role,
      id: user._id,
      fullName: user.fullName,
      profilepicture: user.profilepicture,
      ...(user.role === roleenum.doctor && { 
          subscriptionPlan,
          subscriptionFeatures,
          clinicLimit
      }),
      ...(assistantData && { 
          permissions: assistantData.permissions,
          doctorId: assistantData.doctorId?._id || assistantData.doctorId,
          jobTitle: assistantData.jobTitle,
          doctorName: assistantData.doctorId?.fullName,
          clinicId: assistantData.clinicId?._id || assistantData.clinicId,
          clinicName: assistantData.clinicId?.name
      })
    }
  });
};



export const deleteProfile = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;

        if (role === roleenum.doctor) {
            // 1. get doctor record
            const doctor = await db_service.findOne({
                model: doctormodel,
                filter: { userId }
            });

            if (doctor) {
                // 2. delete cloudinary images
                if (doctor.licenseimage?.public_id) {
                    await cloudinary.uploader.destroy(doctor.licenseimage.public_id);
                }
                if (doctor.nationalId?.public_id) {
                    await cloudinary.uploader.destroy(doctor.nationalId.public_id);
                }

                // 3. delete doctor-related data
                await Promise.all([
                    db_service.deleteMany({ model: availabilitymodel, filter: { doctorId: userId } }),
                    db_service.deleteMany({ model: slotmodel, filter: { doctorId: userId } }),
                    db_service.deleteMany({ model: appointmentsmodel, filter: { doctorId: userId } }),
                    db_service.deleteMany({ model: clinicmodel, filter: { doctorId: userId } }),
                    db_service.deleteMany({ model: reviewmodel, filter: { doctorId: userId } }),
                    db_service.deleteOne({ model: doctormodel, filter: { userId } })
                ]);
            }

        } else if (role === roleenum.patient) {
            // 1. delete patient-related data
            await Promise.all([
                db_service.deleteMany({ model: appointmentsmodel, filter: { patientId: userId } }),
                db_service.deleteMany({ model: notificationmodel, filter: { userId } }),
                db_service.deleteMany({ model: reviewmodel, filter: { patientId: userId } }),
                db_service.deleteOne({ model: patientmodel, filter: { userId } })
            ]);
        }

        // 4. delete profile picture from cloudinary
        if (req.user.profilepicture?.public_id) {
            await cloudinary.uploader.destroy(req.user.profilepicture.public_id);
        }

        // 5. delete user
        await db_service.deleteOne({ model: usermodel, filter: { _id: userId } });

        return successresponse({ res, status: 200, message: "profile deleted successfully" });
    } catch (error) {
        next(error);
    }
};
