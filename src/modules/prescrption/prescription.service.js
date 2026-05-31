import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import cloudinary from "../../common/utilits/cloudinary.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js"


export const createPrescription = async ({ patientId, doctorId, diagnosis, medicines, notes }) => {
    const prescription = new prescrptionmodel({
        patientId,
        doctorId,
        diagnosis,
        medications: medicines,
        notes: notes || "",
    });

    await prescription.save();
    return prescription;
};
