import Joi from "joi"

export const getquestionsschema = {
    query: Joi.object({
        specialization: Joi.string()
            .valid("cardiology", "dermatology", "neurology", "general")
            .optional()
    })
}