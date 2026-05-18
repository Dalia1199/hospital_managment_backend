import joi from "joi"
// const customid=(v,helper)=>{
//     const value=types.objectid.isvaid(v)
//     return isvalid ? v:helper.message("id is not valid");
// }
import mongoose from "mongoose"
import { Types } from "mongoose"
// export const generalrules={
//      email: joi.string().email({tlds:{allow:false,deny:["outlookk"]},maxDomainSegments:2,minDomainSegments:3}).required(),
//             password: joi.string().min(20).required().messages({ "any.required": "password must not be empty","string.min":"password is too short"}),
//             cpassword:joi.string().valid(joi.ref("password")).required(),
//             id:joi.string().custom((value,helper)=>{
//                 const isvalid=mongoose.Types.objectid.isvalid(value)
//                 return isvalid? value:helper.message("invalid id")
//             }),
//     files: joi.array().max(2).items(
//         ({
//         fieldname: joi.string().required(),
//         originalname: joi.string().required(),
//         encoding: joi.string().required(),
//         mimeType: joi.string().required(),
//         destination: joi.string().required(),
//         path: joi.string().required(),
//         size: joi.number().required(),
//     }).required().messages({ 'any.required': "file is required" }))
// }
export const generalrules = {
    email: joi
        .string()
        .email({ tlds: { allow: false } })
        .required(),

    password: joi
        .string()
        .min(6)
        .required()
        .messages({
            "any.required": "password must not be empty",
            "string.min": "password is too short"
        }),

    confirmPassword: joi
        .string()
        .valid(joi.ref("password"))
        .required()
        .messages({
            "any.only": "passwords do not match"
        }),

    id: joi.string().custom((value, helper) => {
        const isValid = mongoose.Types.ObjectId.isValid(value);
        return isValid ? value : helper.message("invalid id");
    }),

    files: joi
        .array()
        .max(2)
        .items(
            joi.object({
                fieldname: joi.string().required(),
                originalname: joi.string().required(),
                encoding: joi.string().required(),
                mimetype: joi.string().required(),
                destination: joi.string().required(),
                path: joi.string().required(),
                size: joi.number().required()
            })
        )
        .messages({
            "array.max": "you can upload max 2 files"
        })
};