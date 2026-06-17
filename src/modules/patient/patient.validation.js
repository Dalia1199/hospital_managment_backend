import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const getSinglePrescriptionSchema = {

    params: Joi.object({
        prescriptionId: generalrules.id.required()
    }).required()

}

export const updatePatientProfileSchema = {
  body: Joi.object({
    // user model fields
    
    fullName: Joi.string().min(3).max(100).trim().optional(),
    phoneNumber: Joi.string().min(10).max(15).trim().optional(),
    address: Joi.string().trim().optional(),

    // patient model fields
    age: Joi.number().min(1).max(120).optional(),
    gender: Joi.string().valid("male", "female").optional(),
    bloodType: Joi.string()
      .valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
      .optional(),

    allergies: Joi.array().items(Joi.string().trim()).optional(),
    chronic: Joi.array().items(Joi.string().trim()).optional(),
    weight: Joi.string().optional(),
    height: Joi.string().optional(),
    pulse:  Joi.string().optional(),

    surgeries: Joi.array()
      .items(
        Joi.object({
          _id: generalrules.id.optional(),
          operationName: Joi.string().trim().required(),
          surgeonName: Joi.string().trim().required(),
          date: Joi.string().required(),
          report: Joi.string().trim().required(),
        })
      )
      .optional(),
  }),
};

