import patientmodel from "../../DB/models/patientmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import usermodel from "../../DB/models/usermodel.js";
import { decrypt } from "../../common/utilits/security/encrypt.js";

import cloudinary from "../../common/utilits/cloudinary.js";

export const getMyPrescriptions = async (req, res, next) => {

    const prescriptions = await db_service.find({
        model: prescriptionmodel,
        filter: {
            patientId: req.user._id
        },
        populate: [
            {
                path: "doctorId",
                select: "fullName email"
            },
            {
                path: "medicalHistoryId"
            }
        ]
    })

    successresponse({
        res,
        data: prescriptions
    })

}
export const getSinglePrescription = async (req, res, next) => {

    const { prescriptionId } = req.params

    const prescription = await db_service.findOne({
        model: prescriptionmodel,
        filter: {
            _id: prescriptionId,
            patientId: req.user._id
        },
        populate: [
            {
                path: "doctorId",
                select: "fullName email"
            },
            {
                path: "medicalHistoryId"
            }
        ]
    })

    if (!prescription) {
        throw new Error("prescription not found", { cause: 404 })
    }

    successresponse({
        res,
        data: prescription
    })

}
//done
export const updatePatientProfile = async (req, res, next) => {

    const user = await db_service.findOneAndUpdate({

        model: usermodel,

        filter: {
            _id: req.user._id
        },

        update: req.body

    })

    successresponse({
        res,
        message: "profile updated successfully",
        data: user
    })

}
//done
export const uploadProfileImage = async (req, res, next) => {
    console.log("BEFORE CLOUDINARY");
    if (!req.file) {
        throw new Error("image required", { cause: 400 })
    }
    console.log("CLOUD NAME:", process.env.CLOUD_NAME);
    console.log("API KEY:", process.env.API_KEY);
    const { secure_url, public_id } =
        await cloudinary.uploader.upload(req.file.path, {


            folder: "carehub/patient"

        })

    const user = await db_service.findOneAndUpdate({


        model: usermodel,

        filter: {
            _id: req.user._id
        },

        update: {

            profilepicture: {
                secure_url,
                public_id
            }

        },

        options: {
            new: true
        }

    })

    successresponse({

        res,

        message: "profile image uploaded successfully",

        data: user

    })

}
//done
export const deleteProfileImage = async (req, res, next) => {

    if (!req.user.profilepicture?.public_id) {
        throw new Error("image not found", { cause: 404 })
    }

    await cloudinary.uploader.destroy(
        req.user.profilepicture.public_id
    )

    const user = await db_service.findOneAndUpdate({

        model: usermodel,

        filter: {
            _id: req.user._id
        },

        update: {
            profilepicture: null
        },

        options: {
            new: true
        }

    })

    successresponse({

        res,

        message: " profilepicture deleted successfully",

        data: user

    })

}

//done
export const getMyProfile = async (req, res, next) => {

    const user = await db_service.findOne({

        model: usermodel,

        filter: {
            _id: req.user._id,
            role: roleenum.patient
        },

        select: `
            fullName
            email
            phoneNumber
            age
            gender
            bloodType
            address
            profilepicture
            role
        `

    })

    if (!user) {
        throw new Error("patient not found", { cause: 404 })
    }

    const userdata = user.toObject()

    if (userdata.phoneNumber) {
        userdata.phoneNumber = decrypt(userdata.phoneNumber)
    }

    successresponse({

        res,

        data: userdata

    })

}
//done
export const updateProfileImage = async (req, res, next) => {

    if (!req.file) {
        throw new Error("image is required", { cause: 400 })
    }

    if (req.user.image?.public_id) {

        await cloudinary.uploader.destroy(
            req.user.image.public_id
        )

    }

    const { secure_url, public_id } =
        await cloudinary.uploader.upload(req.file.path, {

            folder: "carehub/patient"

        })

    const user = await db_service.findOneAndUpdate({

        model: usermodel,

        filter: {
            _id: req.user._id
        },

        update: {

            image: {
                secure_url,
                public_id
            }

        },

        options: {
            new: true
        }

    })

    successresponse({

        res,

        message: "profile image updated successfully",

        data: user

    })

}

