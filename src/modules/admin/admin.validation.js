import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const approveDoctorSchema = {
    params: Joi.object({
        id: generalrules.id.required()
    })
};

export const rejectDoctorSchema = {
    params: Joi.object({
        id: generalrules.id.required()
    })
};

export const approveLicenseSchema = approveDoctorSchema

export const rejectLicenseSchema = {
    params: Joi.object({
        id: generalrules.id.required()
    }),
    body: Joi.object({
        reason: Joi.string().trim().min(5).max(500).required().messages({
            "string.empty": "rejection reason is required",
            "string.min": "rejection reason must be at least 5 characters",
            "any.required": "rejection reason is required"
        })
    }).required()
};

// add validation for admin to get all users
export const getusersschema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1).optional(),
        limit: Joi.number().integer().min(1).max(100).default(20).optional(),
        role: Joi.string().valid("admin", "doctor", "patient").optional(),
        status: Joi.string().valid("active", "blocked", "pending", "offline").optional(),
        search: Joi.string().allow("").optional()
    }).unknown(true).required()
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

// ─── Admin Profile ────────────────────────────────────────────────────────────
export const updateAdminProfileSchema = {
    body: Joi.object({
        fullName: Joi.string().min(3).max(100).trim().optional(),
        phoneNumber: Joi.string().trim().min(10).max(15).optional(),
        address: Joi.string().trim().optional(),
    }).required()
};

