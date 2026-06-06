import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const  rejectorapproveDoctorSchema = {
    params: Joi.object({
        id: generalrules.id.required()
    })
};


// add validation for admin to get all users
export const getusersschema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1).optional(),
        limit: Joi.number().integer().min(1).max(100).default(20).optional(), 
        role: Joi.string().valid("admin", "doctor", "patient").optional()
    }).required()
};
// validate the ID sent in the URL using params
export const activateAndDeactivateSchema = {
    params: Joi.object({
        id: Joi
            .string()
            .hex()
            .length(24)
            .required()
            .messages({
                "string.base": "ID must be a string",
                "string.hex": "ID must be a valid MongoDB ObjectId",
                "string.length": "ID must be exactly 24 characters long",
                "any.required": "ID is required",
            })
    })
}
