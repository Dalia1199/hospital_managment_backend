import prescrptionmodel from "../../DB/models/prescriptionmodel.js";
import * as db_service from "../../DB/db.service.js";
import medicalhistorymodel from "../../DB/models/medicalhistorymodel.js"; 
import { successresponse } from "../../common/utilits/responce.success.js"
import cloudinary from "../../common/utilits/cloudinary.js";
import { checkDoctorAccess } from "../doctor/doctor.service.js";

// Update the text fields of a prescription (diagnosis, medications list, and notes)
export const updatePrescription = async (req, res, next) => {
    // 1. Get the prescription ID from URL parameters
    const { id } = req.params;

    // 2. Search for the prescription in the database
    const prescription = await db_service.findOne({
        model: prescrptionmodel,
        filter: { _id: id }
    });

    // 3. Error Check: Make sure the prescription actually exists
    if (!prescription) {
        throw new Error("Prescription not found", { cause: 404 });
    }

    // 4. Authorization Check: Only the doctor who originally created this prescription can edit it
    if (prescription.doctorId.toString() !== req.user._id.toString()) {
        throw new Error("Not authorized. Only the creator doctor can update this prescription", { cause: 403 });
    }

    // 5. Database Update: Update only the fields that were sent in the request body (req.body)
    const updatedPrescription = await db_service.findOneAndUpdate({
        model: prescrptionmodel,
        filter: { _id: id },
        update: req.body,   
        options: { new: true } // Return the updated document instead of the old one
    });

    // 6. Return response: Send the updated prescription data to the client
    return successresponse({
        res,
        status: 200,
        message: "Prescription updated successfully",
        data: updatedPrescription
    });
};

// Upload a scanned image/PDF file of the prescription and attach it to both the prescription and the patient's medical history
export const uploadPrescriptionImage = async (req, res, next) => {
    // 1. Get the prescription ID from URL parameters
    const { id } = req.params;

    // 2. Error Check: Verify that the client uploaded a file (parsed by Multer)
    if (!req.file) {
        throw new Error("Please upload a prescription image or pdf file", { cause: 400 });
    }

    // 3. Search for the prescription in the database
    const prescription = await db_service.findOne({
        model: prescrptionmodel,
        filter: { _id: id }
    });

    // 4. Error Check: Make sure the prescription exists
    if (!prescription) {
        throw new Error("Prescription not found", { cause: 404 });
    }

    // 5. Authorization Check: Only the creator doctor is allowed to upload files to this prescription
    if (prescription.doctorId.toString() !== req.user._id.toString()) {
        throw new Error("Not authorized. Only the creator doctor can upload a file for this prescription", { cause: 403 });
    }

    // 6. Cloudinary Upload: Upload the file from its temporary local path (req.file.path)
    // We store it in a virtual folder named "carehub/prescriptions" inside Cloudinary
    const { secure_url, public_id } = await cloudinary.uploader.upload(req.file.path, {
        folder: "carehub/prescriptions"
    });

    // 7. Database Update: Save the secure URL and Cloudinary public ID inside the prescription record
    const updatedPrescription = await db_service.findOneAndUpdate({
        model: prescrptionmodel,
        filter: { _id: id },
        update: { prescriptionImage: { secure_url, public_id } },
        options: { new: true } 
    });

    // 8. Medical History Link: If the prescription is associated with a medical history record,
    // we also push the uploaded file info to the medical history's documents list
    if (prescription.medicalHistoryId) {
        await db_service.findOneAndUpdate({
            model: medicalhistorymodel,
            filter: { _id: prescription.medicalHistoryId },
            update: {
                $push: {
                    documents: {
                        type: "prescription",
                        title: `Prescription - ${prescription.diagnosis}`,
                        secure_url,
                        public_id,
                        uploadedBy: req.user._id, // The logged-in doctor who uploaded the file
                        notes: prescription.notes || ""
                    }
                }
            }
        });
    } 

    // 9. Return response: Send back the updated prescription document with the new image fields
    return successresponse({
        res,
        status: 200,
        message: "Prescription image uploaded successfully",
        data: updatedPrescription
    });
}

export const deleteprescrption = async (req, res, next) => {
    const { user } = req; 

   
    const prescription = await prescrptionmodel.findById(req.params.id);

    if (!prescription) {
        throw new Error('No prescription found with that ID');
    }

  
    if (user.role === "doctor" && prescription.doctorId.toString() !== user._id.toString()) {
        throw new Error("you are not allowed to delete this prescription");
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

        let filter = { patientId };

        if (req.user.role === "doctor") {
            const { hasAccess, sharingSetting } = await checkDoctorAccess(req.user._id, patientId);
            if (!hasAccess || sharingSetting === "own_only") {
                filter.doctorId = req.user._id;
            }
        }

        const prescriptions = await db_service.find({
            model: prescrptionmodel,
            filter,
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
}