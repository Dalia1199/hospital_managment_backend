import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

// Validation rules for updating the text fields of a prescription (PATCH /prescriptions/:id)
export const updatePrescriptionSchema = {
    // Validate the prescription ID in the URL path. Must be a valid MongoDB ObjectId.
    params: Joi.object({
        id: generalrules.id.required()
    }).required(),

    // Validate the fields the doctor wants to update. 
    // They are all optional so the doctor can update just one field, or all of them.
    body: Joi.object({
        diagnosis: Joi.string().trim().optional(),

        // If the doctor provides the medications array, each medicine item must have its details
        medications: Joi.array().items(
            Joi.object({
                medicineName: Joi.string().trim().required(),
                dosage: Joi.string().trim().required(),
                frequency: Joi.string().trim().required(),
                duration: Joi.string().required(),
                instructions: Joi.string().trim().optional().allow("") // instructions can be left empty
            })
        ).optional(),

        notes: Joi.string().trim().optional().allow("") // notes are optional and can be cleared out (empty string)
    }).required()
};


// Validation rules for uploading a scanned prescription file (PATCH /prescriptions/:id/upload)
export const uploadPrescriptionSchema = {
    // We only need to check the prescription ID in the URL path. 
    // The uploaded file itself is validated by Multer in the controller.
    params: Joi.object({
        id: generalrules.id.required()
    }).required()
};
