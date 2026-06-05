import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import * as db_service from "../../DB/db.service.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js"; 
import { successresponse } from "../../common/utilits/responce.success.js"

export const deleteprescrption = async (req, res, next) => {
    const { user } = req; 

   
    const prescription = await prescrptionmodel.findById(req.params.id);

    if (!prescription) {
        return new Error('No prescription found with that ID');
    }

  
    if (user.role === "doctor" && prescription.doctorid.toString() !== user._id.toString()) {
        return new Error("you are not allowed to delete this prescription");
    }

   
    await prescrptionmodel.findByIdAndUpdate(req.params.id, { status: "cancelled" }, { new: true });

    successresponse({ res, message: "prescription deleted successfully" });
};

export const createPrescription = async (req, res, next) => {
    // Extract medicalHistoryId from the request body
     const { patientId, medicalHistoryId, diagnosis, medications, notes } = req.body;

// if medicalHistoryId found and verify it exists and belongs to the same petient
    if (medicalHistoryId) {
        const history = await medicalhistorymodel.findOne({
            _id: medicalHistoryId,
            patientId
        });

        if (!history) {
            throw new Error("medical history not found or does not belong to this patient", { cause: 404 });
        }
    }

    // Store the medicalHistoryId on the prescription itself, or null if not provided
    const prescription = await prescrptionmodel.create({
        patientId,
        doctorId: req.user._id,
        medicalHistoryId: medicalHistoryId || null,
        diagnosis,
        medications,
        notes: notes || ""
    });

    // if medicalHistory found  push id into the medical history's prescriptions array
    if (medicalHistoryId) {
        await medicalhistorymodel.findByIdAndUpdate(
            medicalHistoryId,
            { $push: { prescriptions: prescription._id } }
        );
    }

    successresponse({
        res,
        message: "Prescription created successfully",
        data: prescription
    });
};

export const getPatientPrescriptions = async (req, res, next) => {
    try {
        const { patientId } = req.params;

        // patient can only access their own prescriptions
        if (req.user.role === "patient" && req.user._id.toString() !== patientId) {
            return res.status(403).json({ message: "not authorized to access this patient's prescriptions" });
        }

        const prescriptions = await db_service.find({
            model: prescrptionmodel,
            filter: { patientId },
            options: {
                populate: [
                    { path: "doctorId", select: "userName email" },
                    { path: "medicalHistoryId" }
                ],
                sort: { createdAt: -1 }
            }
        });

        return successresponse({
            res,
            status: 200,
            message: "prescriptions fetched successfully",
            data: prescriptions
        });
    } catch (error) {
        next(error);
    }
};
