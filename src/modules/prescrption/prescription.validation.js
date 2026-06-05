import Joi from "joi";

export const deletePrescriptionSchema = Joi.object({
    params: Joi.object({
        id: Joi.string().required()
    }).required()
})

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
