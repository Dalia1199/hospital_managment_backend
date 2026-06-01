import Joi from "joi";

export const getPatientPrescriptionsSchema = {
    params: Joi.object({
        patientId: Joi.string().hex().length(24).required()
    })
};