import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const addClinicSchema = {
    body: Joi.object({
        name:    Joi.string().required(),
        address: Joi.string().required(),
        phone:   Joi.string().optional()
    }).required()
};

export const updateClinicSchema = {
    params: Joi.object({
        clinicId: generalrules.id.required()
    }).required(),
    body: Joi.object({
        name:     Joi.string(),
        address:  Joi.string(),
        phone:    Joi.string(),
        isActive: Joi.boolean()
    }).min(1).required()
};

export const clinicIdSchema = {
    params: Joi.object({
        clinicId: generalrules.id.required()
    }).required()
};

export const doctorIdSchema = {
    params: Joi.object({
        doctorId: generalrules.id.required()
    }).required()
};