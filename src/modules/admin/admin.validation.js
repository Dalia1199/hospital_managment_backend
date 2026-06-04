import Joi from "joi";

// add validation for admin to get all users
export const getusersschema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1).optional(),
        limit: Joi.number().integer().min(1).max(100).default(20).optional(), 
        role: Joi.string().valid("admin", "doctor", "patient").optional()
    }).required()
};
