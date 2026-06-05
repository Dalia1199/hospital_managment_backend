import doctormodel from "../../DB/models/doctormodel.js";
import usermodel from "../../DB/models/usermodel.js";
import patientmodel from "../../DB/models/patientmodel.js";
import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import { roleenum } from "../../common/enum/user.enum.js";
import cloudinary from "../../common/utilits/cloudinary.js";

export const getDashboard = async (req, res, next) => {
    try {
        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            return res.status(404).json({ message: "doctor profile not found" });
        }

        const [totalPatients, totalPrescriptions, totalMedicalHistories] = await Promise.all([
            prescrptionmodel.distinct("patientId", { doctorId: req.user._id }).then(r => r.length),
            db_service.count({ model: prescrptionmodel, filter: { doctorId: req.user._id } }),
            db_service.count({ model: medicalhistorymodel, filter: { doctorId: doctor._id } })
        ]);

        return successresponse({
            res,
            status: 200,
            message: "dashboard stats fetched successfully",
            data: { totalPatients, totalPrescriptions, totalMedicalHistories }
        });
    } catch (error) {
        next(error);
    }
};

export const uploadLicense = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new Error("image/pdf file is required", { cause: 400 });
        }

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: req.user._id }
        });

        if (!doctor) {
            throw new Error("doctor profile not found", { cause: 404 });
        }

        const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
            folder: "carehub/doctors/licenses"
        });

        const oldPublicId = doctor.licenseimage?.public_id;

        try {
            const updatedDoctor = await db_service.findOneAndUpdate({
                model: doctormodel,
                filter: { userId: req.user._id },
                update: { licenseimage: { secure_url, public_id } },
                options: { new: true }
            });

            await db_service.findOneAndUpdate({
                model: usermodel,
                filter: { _id: req.user._id },
                update: { status: "pending" }
            });

            if (oldPublicId) {
                await cloudinary.uploader.destroy(oldPublicId);
            }

            return successresponse({
                res,
                message: "license updated successfully, pending admin approval",
                data: updatedDoctor
            });

        } catch (dbError) {
            await cloudinary.uploader.destroy(public_id);
            throw dbError;
        }

    } catch (error) {
        return next(error);
    }
};