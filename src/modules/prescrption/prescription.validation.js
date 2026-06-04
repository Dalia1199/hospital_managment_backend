import Joi from "joi";

export const deletePrescriptionSchema = Joi.object({
    params: Joi.object({
        id: Joi.string().required()
    }).required()
})

