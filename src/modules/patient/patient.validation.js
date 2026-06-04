import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const getSinglePrescriptionSchema = {

    params: Joi.object({
        prescriptionId: generalrules.id.required()
    }).required()

}
export const updatePatientProfileSchema = {

    body: Joi.object({

        fullName: Joi.string(),

        age: Joi.number(),

        gender: Joi.string().valid("male", "female"),

        phoneNumber: Joi.string(),

        address: Joi.string(),

        bloodType: Joi.string()

    }).required()

}

