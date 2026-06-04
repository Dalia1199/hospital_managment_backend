import Joi from "joi";

export const approveDoctorSchema = Joi.object({
    params: Joi.object({
        id: Joi.string().required()
    })
});

export const rejectDoctorSchema = Joi.object({
    params: Joi.object({
        id: Joi.string().required()
    })
});
