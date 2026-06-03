import Joi from "joi";

// validate the ID sent in the URL using params
export const activateAndDeactivateSchema = {
    params: Joi.object({
        id: Joi
            .string()
            .hex()
            .length(24)
            .required()
            .messages({
                "string.base": "ID must be a string",
                "string.hex": "ID must be a valid MongoDB ObjectId",
                "string.length": "ID must be exactly 24 characters long",
                "any.required": "ID is required",
            })
    })
}