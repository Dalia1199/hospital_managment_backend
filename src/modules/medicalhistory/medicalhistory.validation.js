import Joi from "joi";

export const createMedicalHistorySchema = {
    body: Joi.object({
        isOfflinePatient: Joi.boolean().default(false),
        patientId: Joi.when("isOfflinePatient", {
            is: true,
            then: Joi.optional(),
            otherwise: Joi.string().required()
        }),
        guestName: Joi.when("isOfflinePatient", {
            is: true,
            then: Joi.string().required(),
            otherwise: Joi.optional()
        }),
        guestPhone: Joi.string().optional(),
        diagnosis: Joi.string().required(),
        notes: Joi.string().allow("", null)
    }).required()
};

export const getMedicalHistorySchema = {
    params: Joi.object({
        patientId: Joi.string().required()
    }).required()
};

export const uploadDocumentSchema = {
    params: Joi.object({
        historyId: Joi.string().required()
    }).required(),

    body: Joi.object({
        type: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).optional(),

        title: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).optional(),

        notes: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).optional()
    }).unknown(true) 
};

export const deleteDocumentSchema = {
    params: Joi.object({
        historyId: Joi.string().required(),
    }).required()
};