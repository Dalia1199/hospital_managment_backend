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
    }).unknown(false).required()
};


// Validation rules for uploading a scanned prescription file (PATCH /prescriptions/:id/upload)
export const uploadPrescriptionSchema = {
    // We only need to check the prescription ID in the URL path. 
    // The uploaded file itself is validated by Multer in the controller.
    params: Joi.object({
        id: generalrules.id.required()
    }).required()
};
export const deletePrescriptionSchema = {
    params: Joi.object({
        id:generalrules.id.required()
    }).required()
};
const medicineSchema = Joi.object({
    medicineName: Joi.string().trim().min(2).max(100).required().messages({
        "string.empty": "Medicine name is required",
        "string.min": "Medicine name must be at least 2 characters",
        "any.required": "Medicine name is required",
    }),

    dosage: Joi.string().trim().min(1).max(50).required().messages({
        "string.empty": "Dosage is required",
        "any.required": "Dosage is required",
    }),

    frequency: Joi.string().trim().min(1).max(100).required().messages({
        "string.empty": "Frequency is required",
        "any.required": "Frequency is required",
    }),

    duration: Joi.string().trim().min(1).max(100).required().messages({
        "string.empty": "Duration is required",
        "any.required": "Duration is required",
    }),

    instructions: Joi.string().trim().max(500).optional().allow(""),
});

export const createPrescriptionSchema = {
    body: Joi.object({
        patientId: Joi.string()
            .pattern(/^[a-f\d]{24}$/i)
            .required()
            .messages({
                "string.pattern.base": "patientId must be a valid MongoDB ObjectId",
                "any.required": "patientId is required",
            }),

        diagnosis: Joi.string().trim().min(3).max(500).required().messages({
            "string.empty": "Diagnosis is required",
            "string.min": "Diagnosis must be at least 3 characters",
            "any.required": "Diagnosis is required",
        }),

            medications: Joi.array().items(medicineSchema).min(1).required().messages({
            "array.min": "At least one medicine is required",
            "any.required": "medicines array is required",
        }),

        notes: Joi.string().trim().max(1000).optional().allow(""),
        // Allow medicalHistoryId in the request body
        medicalHistoryId: Joi.string()
            .pattern(/^[a-f\d]{24}$/i)
            .optional()
            .messages({
                "string.pattern.base": "medicalHistoryId must be a valid MongoDB ObjectId"
        }),
    })
}

export const getPatientPrescriptionsSchema = {
    params: Joi.object({
        patientId: Joi.string().hex().length(24).required()
    })
};
