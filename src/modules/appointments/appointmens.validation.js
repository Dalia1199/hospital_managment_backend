import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const addAvailabilitySchema = {

    body: Joi.object({

        day: Joi.string()
            .valid(
                "sunday",
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday"
            )
            .required(),

        startTime: Joi.string()
            .required(),

        endTime: Joi.string()
            .required(),

        appointmentDuration: Joi.number()
            .valid(15, 20, 30, 45, 60)
            .required()

    }).required()

};

export const generateSlotsSchema = {

    body: Joi.object({

        startDate: Joi.date().required(),

        endDate: Joi.date()
            .greater(Joi.ref("startDate"))
            .required()

    }).custom((value, helpers) => {

        const start = new Date(value.startDate);
        const end = new Date(value.endDate);

        const diffDays =
            Math.ceil(
                (end - start) /
                (1000 * 60 * 60 * 24)
            );

        if (diffDays > 90) {

            return helpers.error(
                "any.invalid"
            );

        }

        return value;

    }).messages({

        "any.invalid":
            "maximum generation period is 90 days"

    })

};
export const getAvailableSlotsSchema = {

    params: Joi.object({

        doctorId: generalrules.id.required().messages({

                "string.hex": "invalid doctor id",

                "string.length": "doctor id must be 24 characters",

                "any.required": "doctor id is required"

            })

    }).required()

};
export const bookAppointmentSchema = {

    body: Joi.object({

        slotId: generalrules.id.required()
          
            .messages({

                "string.hex": "invalid slot id",

                "string.length": "slot id must be 24 characters",

                "any.required": "slot id is required"

            }),

       

    }).required()

};
export const cancelAppointmentSchema = {

    params: Joi.object({

        appointmentId: generalrules.id.required().messages({

                "string.hex": "invalid appointment id",

                "string.length": "appointment id must be 24 characters",

                "any.required": "appointment id is required"

            })

    }).required()

};
export const completeAppointmentSchema = {

    params: Joi.object({

        appointmentId: generalrules.id.required()
            
            .messages({

                "string.hex": "invalid appointment id",

                "string.length": "appointment id must be 24 characters",

                "any.required": "appointment id is required"

            })

    }).required()

};
export const deleteSlotSchema = {

    params: Joi.object({

        slotId: generalrules.id.required()
           

    }).required()

}
export const updateSlotSchema = {

    params: Joi.object({

        slotId:generalrules.id.required()

    }).required(),

    body: Joi.object({

        date: Joi.date().greater("now"),

        startDateTime: Joi.string(),

        endDateTime: Joi.string()

    }).min(1)

}
export const rescheduleAppointmentSchema = {
    params: Joi.object({
        appointmentId: generalrules.id.required()
    }).required(),

    body: Joi.object({
        newSlotId: generalrules.id.required()
    })
        .required()
        .custom((value, helpers) => {
            if (value.newSlotId === value.currentSlotId) {
                return helpers.error("any.invalid");
            }
            return value;
        })
        .messages({
            "any.required": "newSlotId is required"
        })
};
export const getPatientAppointmentsSchema = {
    query: Joi.object({
        status: Joi.string()
            .valid("booked", "completed", "cancelled"),

        page: Joi.number().min(1).default(1),

        limit: Joi.number().min(1).max(50).default(10)
    })
};