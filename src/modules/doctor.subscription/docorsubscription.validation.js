import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const getDoctorSubscriptionSchema = {

    params: Joi.object({

        subscriptionId:

            generalrules.id.required()

    }).required()

};
export const getDoctorSubscriptionByDoctorSchema = {

    params: Joi.object({

        doctorId:

            generalrules.id.required()

    }).required()

};
export const cancelSubscriptionSchema = {

    params: Joi.object({

        subscriptionId:

            generalrules.id.required()

    }).required(),

    body: Joi.object({

        cancelReason:

            Joi.string()

                .min(3)

                .max(300)

                .required()

    }).required()

};
export const renewSubscriptionSchema = {

    params: Joi.object({

        subscriptionId:

            generalrules.id.required()

    }).required()

};