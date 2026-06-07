import Joi from "joi";

export const approveDoctorSchema = {
    params: Joi.object({
        id: Joi.string().required()
    })
};

export const rejectDoctorSchema = {
    params: Joi.object({
        id: Joi.string().required()
    })
};
