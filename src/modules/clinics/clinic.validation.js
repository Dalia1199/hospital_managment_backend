import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";
import { egyptianGovernorates} from "../../DB/models/clinic_model.js";



// Egyptian mobile numbers: 010/011/012/015 followed by 8 digits
const phoneRegex = /^01[0125][0-9]{8}$/;
// Egyptian landlines: leading 0 + area code + local number (8-10 digits total)
const landlineRegex = /^0[2-9][0-9]{6,9}$/;

export const addClinicSchema = {
    body: Joi.object({
        name:        Joi.string().trim().required(),
        address:     Joi.string().trim().required(),
        governorate: Joi.string().valid(...egyptianGovernorates).required(),
        phone:       Joi.string().pattern(phoneRegex).optional()
                        .messages({ "string.pattern.base": "invalid Egyptian mobile number" }),
        whatsapp:    Joi.string().pattern(phoneRegex).optional()
                        .messages({ "string.pattern.base": "invalid WhatsApp number" }),
        landline:    Joi.string().pattern(landlineRegex).optional()
                        .messages({ "string.pattern.base": "invalid landline number" })
    })
    .or("phone", "whatsapp", "landline")
    .required()
    .messages({ "object.missing": "at least one contact number is required" })
};

export const updateClinicSchema = {
    params: Joi.object({ clinicId: generalrules.id.required() }).required(),
        body: Joi.object({
            name:        Joi.string().trim(),
            address:     Joi.string().trim(),
            governorate: Joi.string().valid(...egyptianGovernorates),
            phone:       Joi.string().pattern(phoneRegex).allow("")
                            .messages({ "string.pattern.base": "invalid Egyptian mobile number" }),
            whatsapp:    Joi.string().pattern(phoneRegex).allow("")
                            .messages({ "string.pattern.base": "invalid WhatsApp number" }),
            landline:    Joi.string().pattern(landlineRegex).allow("")
                            .messages({ "string.pattern.base": "invalid landline number" }),
            isActive:    Joi.boolean()
        }).min(1).required()
    };

export const clinicIdSchema = {
    params: Joi.object({
        clinicId: generalrules.id.required()
    }).required()
};

export const doctorIdSchema = {
    params: Joi.object({ doctorId: generalrules.id.required() }).required(),
    query:  Joi.object({ governorate: Joi.string().valid(...egyptianGovernorates).optional() })
};

// ─── Services ─────────────────────────────────────────────────────────────────

export const addServiceSchema = {
    params: Joi.object({ clinicId: generalrules.id.required() }).required(),
    body: Joi.object({
        name:  Joi.string().trim().required(),
        price: Joi.number().min(0).required()
    }).required()
};

export const updateServiceSchema = {
    params: Joi.object({
        clinicId:  generalrules.id.required(),
        serviceId: generalrules.id.required()
    }).required(),
    body: Joi.object({
        name:  Joi.string().trim(),
        price: Joi.number().min(0)
    }).min(1).required()
};

export const serviceIdSchema = {
    params: Joi.object({
        clinicId:  generalrules.id.required(),
        serviceId: generalrules.id.required()
    }).required()
};
