import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js"

export const createPrescription = async (req, res, next) => {
    const { patientId, diagnosis, medicines, notes } = req.body;

    const prescription = await prescrptionmodel.create({
        patientId,
        doctorId: req.user._id,
        diagnosis,
        medicines,
        notes: notes || ""
    });

    successresponse({
        res,
        message: "Prescription created successfully",
        data: prescription
    });
};

