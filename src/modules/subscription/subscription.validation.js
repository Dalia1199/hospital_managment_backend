import { generalrules } from "../../common/utilits/generalrules.js";
import Joi from "joi";

// =========================
// Feature Schema
// =========================

const featureSchema = Joi.object({

    code: Joi.string()
        .trim()
        .required(),

    name: Joi.string()
        .trim()
        .required(),

    enabled: Joi.boolean()
        .optional()

});

// =========================
// Limit Schema
// =========================



// =========================
// CREATE PLAN
// =========================

export const createPlanSchema = {

    body: Joi.object({

        name: Joi.string()
            .min(2)
            .max(50)
            .required(),

        description: Joi.string()
            .allow("")
            .optional(),

        price: Joi.number()
            .min(0)
            .required(),

        durationInDays: Joi.number()
            .min(1)
            .required(),

        features: Joi.array().items(
            Joi.object({
                code: Joi.string().required(),
                name: Joi.string().required(),
                enabled: Joi.boolean()
            })
        ),


        isActive: Joi.boolean()
            .optional()

    }).required()

};

// =========================
// UPDATE PLAN
// =========================

export const updatePlanSchema = {

    params: Joi.object({

        planId:
            generalrules.id.required()

    }).required(),

    body: Joi.object({

        name: Joi.string()
            .min(2)
            .max(50)
            .optional(),

        description: Joi.string()
            .allow("")
            .optional(),

        price: Joi.number()
            .min(0)
            .optional(),

        durationInDays: Joi.number()
            .min(1)
            .optional(),

        features: Joi.array().items(
            Joi.object({
                code: Joi.string().required(),
                name: Joi.string().required(),
                enabled: Joi.boolean()
            }).optional(),
        ),

        

        isActive: Joi.boolean()
            .optional()

    }).required()

};

// =========================
// GET PLAN
// =========================

export const getPlanSchema = {

    params: Joi.object({

        planId:
            generalrules.id.required()

    }).required()

};

// =========================
// DELETE PLAN
// =========================

export const deletePlanSchema = {

    params: Joi.object({

        planId:
            generalrules.id.required()

    }).required()

};

