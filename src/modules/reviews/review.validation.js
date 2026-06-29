import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const addReviewSchema = {
    params: Joi.object({
        doctorId: generalrules.id.required()
    }).required(),
    body: Joi.object({
        rating:  Joi.number().min(1).max(5).required(),
        comment: Joi.string().max(500).optional()
    }).required()
};

export const getDoctorReviewsSchema = {
    params: Joi.object({
        doctorId: generalrules.id.required()
    }).required(),
    query: Joi.object({
        page:  Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(50).default(10)
    })
};

export const deleteReviewSchema = {
    params: Joi.object({
        reviewId: generalrules.id.required()
    }).required()
};