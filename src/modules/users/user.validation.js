import { genderenum } from "../../common/enum/user.enum.js";
import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";


export const signupschema = {
    body: Joi.object({

        fullName: Joi.string().min(7).required(),

        email: generalrules.email.required(),

        password: generalrules.password.required(),
        confirmPassword: generalrules.confirmPassword.required(),

        role: Joi.string().valid("doctor", "patient").required(),

        phoneNumber: Joi.string().required(),

        

        age: Joi.when("role", {
            is: "patient",
            then: Joi.number().required(),
            otherwise: Joi.forbidden()
        }),

        gender: Joi.when("role", {
            is: "patient",
            then: Joi.string().valid(...Object.values(genderenum)).required(),
            otherwise: Joi.forbidden()
        }),

        bloodType: Joi.when("role", {
            is: "patient",
            then: Joi.string().optional(),
            otherwise: Joi.forbidden()
        }),

        address: Joi.when("role", {
            is: "patient",
            then: Joi.string().optional(),
            otherwise: Joi.string().optional()
        }),

      

        specialty: Joi.when("role", {
            is: "doctor",
            then: Joi.string().required(),
            otherwise: Joi.forbidden()
        }),

        syndicateId: Joi.when("role", {
            is: "doctor",
            then: Joi.number().required(),
            otherwise: Joi.forbidden()
        }),

        // nationalId: Joi.when("role", {
        //     is: "doctor",
        //     then: Joi.number().required(),
        //     otherwise: Joi.forbidden()
        // }),

        experience: Joi.when("role", {
            is: "doctor",
            then: Joi.number().optional(),
            otherwise: Joi.forbidden()
        })

    }).required()
};
export const signinschema = {
    body: Joi.object({
        email: generalrules.email.required(),
        password: generalrules.password.required(),
    }).required(),
}



export const resendotpschema = {
    body:Joi.object({
        email: generalrules.email.required(),
    }).required()
}

export const confirmemailschema = {
    body:resendotpschema.body.append({
        code: Joi.string().min(6).required()
    }).required(),
}
export const updateprofileschema = {
    body: Joi.object({
        firstname: Joi.string().trim(),
        lastname: Joi.string().trim(),


        gender: Joi.string().valid(...Object.values(genderenum)).required(),
    }).required(),
}
export const resetpasswordschema = {
    body: Joi.object({
        email: generalrules.email.required(),

        code: Joi.string().min(6).required(),

        newpassword: generalrules.password.required(),

        cpassword: Joi.string()
            .valid(Joi.ref("newpassword"))
            .required()
    }).required()
}

export const updatepassworsschema = {
    body: Joi.object({
        oldpassword: generalrules.password.required(),
        newpassword: generalrules.password.required(),
        cpassword: Joi.string()
            .valid(Joi.ref("newpassword"))
            .required()
    }).required(),
}



