import doctormodel from "../../DB/models/doctormodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import cloudinary from "../../common/utilits/cloudinary.js";
// add update doctor profile logic
export const updatedoctorprofile = async (req, res, next) => {
    try {
        const { bio, specialization, experience } = req.body;

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            throw new Error("Doctor profile not found", { cause: 404 });
        }

        if (bio !== undefined) doctor.bio = bio;
        if (specialization !== undefined) doctor.specialization = specialization;
        if (experience !== undefined) doctor.experience = experience;

        await doctor.save();

        return successresponse({
            res,
            message: "Profile updated successfully",
            data: doctor
        });
    } catch (error) {
          next(error);
        }
    };
    // Implement doctor license upload service 
    export const uploadLicense = async (req, res, next) => {
        try {
            if (!req.file) {
                throw new Error("image/pdf file is required", { cause: 400 });
            }

            const doctor = await db_service.findOne({
                model: doctormodel,
                filter: { userId: req.user._id }
            });
        // 1. Upload new image
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: "carehub/doctors/licenses"
        });

        const oldPublicId = doctor.licenseimage?.public_id;

        try {
            // 2. Update doctor and user profiles in database
            const updatedDoctor = await db_service.findOneAndUpdate({
                model: doctormodel,
                filter: { userId: req.user._id },
                update: {
                    licenseimage: { secure_url, public_id }
                },
                options: { new: true }
            });

            await db_service.findOneAndUpdate({
                model: usermodel,
                filter: { _id: req.user._id },
                update: { status: "pending" }
            });

            // 3. Only delete old image from Cloudinary
            if (oldPublicId) {
                await cloudinary.uploader.destroy(oldPublicId);
            }

            return successresponse({
                res,
                message: "license updated successfully, pending admin approval",
                data: updatedDoctor
            });

        } catch (dbError) {
            //delete the new image from Cloudinary
            await cloudinary.uploader.destroy(public_id);
            throw dbError;
        }

    } catch (error) {
        return next(error);
    }
};
