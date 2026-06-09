import Joi from "joi";

export const createSlotSchema = {

    body: Joi.object({

        date: Joi.date()
            .greater("now")
            .required()
            .messages({

                "date.base": "date must be valid",

                "date.greater": "date must be in future",

                "any.required": "date is required"

            }),

        startTime: Joi.string()
            .required()
            .messages({

                "any.required": "startTime is required"

            }),

        endTime: Joi.string()
            .required()
            .messages({

                "any.required": "endTime is required"

            })

    }).required()

};
export const getAvailableSlotsSchema = {

    params: Joi.object({

        doctorId: Joi.string()
            .hex()
            .length(24)
            .required()
            .messages({

                "string.hex": "invalid doctor id",

                "string.length": "doctor id must be 24 characters",

                "any.required": "doctor id is required"

            })

    }).required()

};
export const bookAppointmentSchema = {

    body: Joi.object({

        slotId: Joi.string()
            .hex()
            .length(24)
            .required()
            .messages({

                "string.hex": "invalid slot id",

                "string.length": "slot id must be 24 characters",

                "any.required": "slot id is required"

            }),

       

    }).required()

};