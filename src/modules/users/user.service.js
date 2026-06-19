import usermodel from "../../DB/models/usermodel.js";
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

  successresponse({
    res,
    message: "success signin",
    data: {
      access_token,
      refreshtoken,
      role: user.role,
      id: user._id,
      fullName: user.fullName,
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
    age,
    gender,
    address,
    bloodType,
    specialty,
    syndicateId,
    nationalId,
    experience,
  } = req.body;

  if (
    await db_service.findOne({
      model: usermodel,
      filter: { email },
    })
  ) {
    throw new Error("email already exists", { cause: 409 });
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

      const admins = await usermodel.find({ role: roleenum.admin }).select("_id");
      await Promise.all(
        admins.map((admin) => notify.newDoctorRegistration(admin._id, user.fullName))
      );

    } else {
      await db_service.create({
        model: patientmodel,
        data: {
          userId: user._id,
          age,
          gender,
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
