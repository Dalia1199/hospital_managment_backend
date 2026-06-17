import patientmodel from "../../DB/models/patientmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import usermodel from "../../DB/models/usermodel.js";
import { decrypt, encrypt } from "../../common/utilits/security/encrypt.js";
import prescriptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";

export const getMyPrescriptions = async (req, res, next) => {
  const prescriptions = await db_service.find({
    model: prescriptionmodel,
    filter: {
      patientId: req.user._id,
    },
    populate: [
      {
        path: "doctorId",
        select: "fullName email",
      },
      {
        path: "medicalHistoryId",
      },
    ],
  });

  successresponse({
    res,
    data: prescriptions,
  });
};
export const getSinglePrescription = async (req, res, next) => {
  const { prescriptionId } = req.params;

  const prescription = await db_service.findOne({
    model: prescriptionmodel,
    filter: {
      _id: prescriptionId,
      patientId: req.user._id,
    },
    populate: [
      {
        path: "doctorId",
        select: "fullName email",
      },
      {
        path: "medicalHistoryId",
      },
    ],
  });

  if (!prescription) {
    throw new Error("prescription not found", { cause: 404 });
  }

  successresponse({
    res,
    data: prescription,
  });
};
// //done
// export const updatePatientProfile = async (req, res, next) => {

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: req.body

//     })

//     successresponse({
//         res,
//         message: "profile updated successfully",
//         data: user
//     })

// }
// //done
// export const uploadProfileImage = async (req, res, next) => {
//     console.log("BEFORE CLOUDINARY");
//     if (!req.file) {
//         throw new Error("image required", { cause: 400 })
//     }
//     console.log("CLOUD NAME:", process.env.CLOUD_NAME);
//     console.log("API KEY:", process.env.API_KEY);
//     const { secure_url, public_id } =
//         await cloudinary.uploader.upload(req.file.path, {

//             folder: "carehub/patient"

//         })

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {

//             profilepicture: {
//                 secure_url,
//                 public_id
//             }

//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: "profile image uploaded successfully",

//         data: user

//     })

// }
// //done
// export const deleteProfileImage = async (req, res, next) => {

//     if (!req.user.profilepicture?.public_id) {
//         throw new Error("image not found", { cause: 404 })
//     }

//     await cloudinary.uploader.destroy(
//         req.user.profilepicture.public_id
//     )

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {
//             profilepicture: null
//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: " profilepicture deleted successfully",

//         data: user

//     })

// }

// //done
// export const getMyProfile = async (req, res, next) => {

//     const user = await db_service.findOne({

//         model: usermodel,

//         filter: {
//             _id: req.user._id,
//             role: roleenum.patient
//         },

//         select: `
//             fullName
//             email
//             phoneNumber
//             age
//             gender
//             bloodType
//             address
//             profilepicture
//             role
//         `

//     })

//     if (!user) {
//         throw new Error("patient not found", { cause: 404 })
//     }

//     const userdata = user.toObject()

//     if (userdata.phoneNumber) {
//         userdata.phoneNumber = decrypt(userdata.phoneNumber)
//     }

//     successresponse({

//         res,

//         data: userdata

//     })

// }
// //done
// export const updateProfileImage = async (req, res, next) => {

//     if (!req.file) {
//         throw new Error("image is required", { cause: 400 })
//     }

//     if (req.user.image?.public_id) {

//         await cloudinary.uploader.destroy(
//             req.user.image.public_id
//         )

//     }

//     const { secure_url, public_id } =
//         await cloudinary.uploader.upload(req.file.path, {

//             folder: "carehub/patient"

//         })

//     const user = await db_service.findOneAndUpdate({

//         model: usermodel,

//         filter: {
//             _id: req.user._id
//         },

//         update: {

//             image: {
//                 secure_url,
//                 public_id
//             }

//         },

//         options: {
//             new: true
//         }

//     })

//     successresponse({

//         res,

//         message: "profile image updated successfully",

//         data: user

//     })

// }

// ─── GET /patient/profile ─────────────────────────────────────────────────────
// يجيب user data + patient data (age, gender, bloodType, allergies, chronic) مع بعض
export const getMyProfile = async (req, res, next) => {
  try {
    const user = await db_service.findOne({
      model: usermodel,
      filter: { _id: req.user._id, role: roleenum.patient },
      select: "fullName email phoneNumber address profilepicture role",
    });

    if (!user) {
      throw new Error("patient not found", { cause: 404 });
    }

    const patient = await db_service.findOne({
      model: patientmodel,
      filter: { userId: req.user._id },
    });

    const userData = user.toObject();

    // decrypt phone number
    if (userData.phoneNumber) {
      userData.phoneNumber = decrypt(userData.phoneNumber);
    }

    return successresponse({
      res,
      data: {
        // user fields
        fullName: userData.fullName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        address: userData.address,
        profilepicture: userData.profilepicture,
        // patient model fields
        age: patient?.age ?? null,
        gender: patient?.gender ?? null,
        bloodType: patient?.bloodType ?? null,
        height: patient?.height ?? null,
        weight: patient?.weight ?? null,
        pulse: patient?.pulse ?? null,
        allergies: patient?.allergies ?? [],
        chronic: patient?.chronic ?? [],
        surgeries: patient?.surgeries ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /patient/profile ───────────────────────────────────────────────────
// يحدّث user fields (fullName, phone, address) + patient fields (age, gender, bloodType, allergies, chronic)
export const updatePatientProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      phoneNumber,
      address,
      age,
      gender,
      bloodType,
      allergies,
      surgeries,
      chronic,
      height,
      weight,
      pulse,
    } = req.body;

    // 1. Update user model
    const userUpdate = {};
    if (fullName !== undefined) userUpdate.fullName = fullName;
    if (address !== undefined) userUpdate.address = address;
    if (phoneNumber !== undefined)
      userUpdate.phoneNumber = encrypt(phoneNumber);

    if (Object.keys(userUpdate).length > 0) {
      await db_service.findOneAndUpdate({
        model: usermodel,
        filter: { _id: req.user._id },
        update: userUpdate,
        options: { new: true },
      });
    }

    // 2. Update patient model
    const patientUpdate = {};
    if (age !== undefined) patientUpdate.age = age;
    if (gender !== undefined) patientUpdate.gender = gender;
    if (bloodType !== undefined) patientUpdate.bloodType = bloodType;
    if (allergies !== undefined) patientUpdate.allergies = allergies;
    if (chronic !== undefined) patientUpdate.chronic = chronic;
    if (surgeries !== undefined) patientUpdate.surgeries = surgeries;
    if (height !== undefined) patientUpdate.height = height;
    if (weight !== undefined) patientUpdate.weight = weight;
    if (pulse !== undefined) patientUpdate.pulse = pulse;

    if (Object.keys(patientUpdate).length > 0) {
      await db_service.findOneAndUpdate({
        model: patientmodel,
        filter: { userId: req.user._id },
        update: patientUpdate,
        options: { new: true, upsert: true },
      });
    }

    return successresponse({
      res,
      message: "profile updated successfully",
      data: {
        fullName,
        phoneNumber, // return plain (not encrypted)
        address,
        age,
        gender,
        bloodType,
        allergies,
        chronic,
        surgeries,
        height,
        weight,
        pulse,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /patient/profile-image ─────────────────────────────────────────────
export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error("image required", { cause: 400 });
    }

    // delete old image if exists
    if (req.user.profilepicture?.public_id) {
      await cloudinary.uploader.destroy(req.user.profilepicture.public_id);
    }

    const { secure_url, public_id } = await cloudinary.uploader.upload(
      req.file.path,
      {
        folder: "carehub/patient",
      },
    );

    const user = await db_service.findOneAndUpdate({
      model: usermodel,
      filter: { _id: req.user._id },
      update: { profilepicture: { secure_url, public_id } },
      options: { new: true },
    });

    return successresponse({
      res,
      message: "profile image uploaded successfully",
      data: { profilepicture: user.profilepicture },
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /patient/profile-image ────────────────────────────────────────────
export const deleteProfileImage = async (req, res, next) => {
  try {
    if (!req.user.profilepicture?.public_id) {
      throw new Error("image not found", { cause: 404 });
    }

    await cloudinary.uploader.destroy(req.user.profilepicture.public_id);

    await db_service.findOneAndUpdate({
      model: usermodel,
      filter: { _id: req.user._id },
      update: { profilepicture: null },
      options: { new: true },
    });

    return successresponse({
      res,
      message: "profile picture deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
