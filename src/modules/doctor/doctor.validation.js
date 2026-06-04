import Joi from "joi";

// Define doctor validation schemas here
export const updateDoctorLicense = {
    file: Joi.object({
        mimetype: Joi.string().valid("image/png", "image/jpeg", "application/pdf").required()
    }).unknown(true).required()
};
