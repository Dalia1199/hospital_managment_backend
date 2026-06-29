import Joi from "joi";
import { title } from "node:process";
import { generalrules } from "../../common/utilits/generalrules.js"

// add validation for update doctor profile
export const updatedoctorprofileschema = {
    body: Joi.object({
        fullName: Joi.string().min(3).max(100).trim().optional(),
        phoneNumber: Joi.string().trim().pattern(/^[0-9]{10,15}$/).optional(),
        address: Joi.string().trim().optional(),
        bio: Joi.string().min(20).max(200).optional(),
        specialization: Joi.string().optional(),
        experience: Joi.number().optional(),
    }).required(),
}

export const updatePatientAlertsSchema = {
    params: Joi.object({
        patientId: Joi.string().pattern(/^[a-f\d]{24}$/i).required()
    }).required(),
    body: Joi.object({
        allergies: Joi.alternatives().try(
            Joi.array().items(Joi.string()),
            Joi.string().allow("")
        ).optional(),
        chronic: Joi.alternatives().try(
            Joi.array().items(Joi.string()),
            Joi.string().allow("")
        ).optional(),
        surgeries: Joi.alternatives().try(
            Joi.string().allow(""),
            Joi.array().items(Joi.object({
                operationName: Joi.string().required(),
                surgeonName: Joi.string().allow("").optional(),
                date: Joi.string().allow("").optional(),
                report: Joi.string().allow("").optional()
            }))
        ).optional()
    }).required()
};

// Define doctor validation schemas here
export const updateDoctorLicense = {
    file: Joi.object({
        mimetype: Joi.string().valid("image/png", "image/jpeg", "application/pdf").required()
    }).unknown(true).required()
};

export const searchPatientSchema = {
    query: Joi.object({
        searchTerm: Joi.string().trim().min(3).required().messages({
            "any.required": "Please provide a search term (Name, Phone)."
        })
    }).required()
};

export const createSessionSchema = {
    body: Joi.object({
        isOfflinePatient: Joi.boolean().default(false),
        patientId: Joi.when("isOfflinePatient", {
            is: true,
            then: Joi.optional(),
            otherwise: Joi.string().pattern(/^[a-f\d]{24}$/i).required().messages({
                "string.pattern.base": "patientId must be a valid MongoDB ObjectId",
                "any.required": "patientId is required for online patients",
            })
        }),
        guestName: Joi.when("isOfflinePatient", {
            is: true,
            then: Joi.string().trim().min(2).max(50).required().messages({
                "any.required": "guestName is required for offline patients"
            }),
            otherwise: Joi.optional()
        }),
        guestPhone: Joi.string().trim().min(10).max(15).optional(),
        guestAge: Joi.number().min(0).max(120).optional()
    })
};

export const verifySessionSchema = {
    body: Joi.object({
        sessionId: Joi.string().pattern(/^[a-f\d]{24}$/i).required(),
        otp: Joi.string().length(6).required()
    }).required()
};
export const endSessionSchema = {
    params: Joi.object({
        sessionId: Joi.string()
            .pattern(/^[a-f\d]{24}$/i)
            .required()
            .messages({
                "string.pattern.base": "sessionId must be a valid MongoDB ObjectId",
                "any.required": "sessionId is required",
            })
    }).required(),
    body: Joi.object({
        fees: Joi.number().min(0).optional(),
        diagnosis: Joi.string().allow("").optional(),
        notes: Joi.string().allow("").optional(),
        prescriptionText: Joi.string().allow("").optional(),
        height: Joi.string().allow("").optional(),
        weight: Joi.string().allow("").optional(),
        bloodPressure: Joi.string().allow("").optional(),
        sugarLevel: Joi.string().allow("").optional(),
        pulse: Joi.string().allow("").optional(),
        temperature: Joi.string().allow("").optional(),
        bloodType: Joi.string().allow("").optional(),
        allergies: Joi.alternatives().try(
            Joi.array().items(Joi.string()),
            Joi.string().allow("")
        ).optional(),
        chronic: Joi.alternatives().try(
            Joi.array().items(Joi.string()),
            Joi.string().allow("")
        ).optional(),
        surgeries: Joi.alternatives().try(
            Joi.string().allow(""),
            Joi.array().items(Joi.object({
                operationName: Joi.string().required(),
                surgeonName: Joi.string().allow("").optional(),
                date: Joi.string().allow("").optional(),
                report: Joi.string().allow("").optional()
            }))
        ).optional(),
        medications: Joi.string().allow("").optional(),
        attachmentsMetadata: Joi.string().allow("").optional()
    }).unknown(true).optional(),
    files: Joi.object().unknown(true).optional()
}

export const cancelSessionSchema = {
    params: Joi.object({
        sessionId: Joi.string()
            .pattern(/^[a-f\d]{24}$/i)
            .required()
            .messages({
                "string.pattern.base": "sessionId must be a valid MongoDB ObjectId",
                "any.required": "sessionId is required",
            })
    }).required()
};

export const getMyPatientsSchema = {
    query: Joi.object({
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional(),
        page: Joi.number().min(1).optional(),
        limit: Joi.number().min(1).optional()
    }).unknown(true).optional()
};

export const getMyPrescriptionsSchema = {
    query: Joi.object({
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional(),
        page: Joi.number().min(1).optional(),
        limit: Joi.number().min(1).optional()
    }).unknown(true).optional()
};

export const addCertificateSchema = {
    body: Joi.object({
        title: Joi.string().min(2).max(100).required(),
        issuer: Joi.string().min(2).max(100).required(),
        issueDate: Joi.date().optional()
    })
};

export const updateCertificateSchema = {
    params: Joi.object({
        certificateId: generalrules.id.required()
    }),
    body: Joi.object({
        title: Joi.string().min(2).max(100),
        issuer: Joi.string().min(2).max(100),
        issueDate: Joi.date()
    }).min(1)
};

export const deleteCertificateSchema = {
    params: Joi.object({
        certificateId: generalrules.id.required()
    })
};

export const reorderSessionSchema = {
    body: Joi.object({
        sessions: Joi.array().items(Joi.object({
            id: Joi.string().pattern(/^[a-f\d]{24}$/i).required(),
            order: Joi.number().required()
        })).min(1).required()
    }).required()
};

export const updateSessionVitalsSchema = {
    params: Joi.object({
        sessionId: Joi.string().pattern(/^[a-f\d]{24}$/i).required()
    }).required(),
    body: Joi.object({
        bloodPressure: Joi.string().allow("").optional(),
        heartRate: Joi.string().allow("").optional(),
        sugarLevel: Joi.string().allow("").optional(),
        temperature: Joi.string().allow("").optional(),
        weight: Joi.string().allow("").optional(),
        height: Joi.string().allow("").optional()
    }).required()
};

export const updateSessionFeesSchema = {
    params: Joi.object({
        sessionId: Joi.string().pattern(/^[a-f\d]{24}$/i).required()
    }).required(),
    body: Joi.object({
        fees: Joi.number().min(0).required(),
        isFeesFinalized: Joi.boolean().optional()
    }).required()
};