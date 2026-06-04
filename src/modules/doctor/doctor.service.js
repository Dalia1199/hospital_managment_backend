import doctormodel from "../../DB/models/doctormodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

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
