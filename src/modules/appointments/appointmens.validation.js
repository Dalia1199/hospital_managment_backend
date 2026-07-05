import Joi from "joi";
import { generalrules } from "../../common/utilits/generalrules.js";

export const addAvailabilitySchema = {

    body: Joi.object({
        
        clinicId: generalrules.id.required(),
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
            .pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'startTime must be in HH:MM 24-hour format, e.g. 09:00' })
            .required(),

        endTime: Joi.string()
            .pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'endTime must be in HH:MM 24-hour format, e.g. 17:00' })
            .required(),

        appointmentDuration: Joi.number()
            .valid(15, 20, 30, 45, 60)
            .required()

    }).required()

};

export const getAvailabilitySchema = {
 
    query: Joi.object({
 
        clinicId: generalrules.id
 
    })
 
};
 
export const updateAvailabilitySchema = {
 
    params: Joi.object({
 
        availabilityId: generalrules.id.required()
 
    }).required(),
 
    // fetchClient auto-appends clinicId from localStorage — allow it to pass through
    query: Joi.object({
        clinicId: generalrules.id
    }),
 
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
            ),
 
        startTime: Joi.string()
            .pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'startTime must be in HH:MM 24-hour format, e.g. 09:00' }),
 
        endTime: Joi.string()
            .pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'endTime must be in HH:MM 24-hour format, e.g. 17:00' }),
 
        appointmentDuration: Joi.number()
            .valid(15, 20, 30, 45, 60),

        force: Joi.boolean()
 
    }).min(1).required()
 
};
 
export const deleteAvailabilitySchema = {
 
    params: Joi.object({
 
        availabilityId: generalrules.id.required()
 
    }).required(),
 
    query: Joi.object({
        force: Joi.boolean(),
        clinicId: generalrules.id
    })
 
};

export const generateSlotsSchema = {
    body: Joi.object({
        clinicId: generalrules.id,
        dates: Joi.array().items(
            Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
        ).min(1).required()
    }).required()
};

export const getAvailableSlotsSchema = {

    params: Joi.object({

        doctorId: generalrules.id.required().messages({

                "string.hex": "invalid doctor id",

                "string.length": "doctor id must be 24 characters",

                "any.required": "doctor id is required"

            })

    }).required(),

    query: Joi.object({
         clinicId: generalrules.id,
         startDate: Joi.date().iso().optional(),
         endDate: Joi.date().iso().optional()
    }).unknown(true).required()

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

export const confirmAppointmentSchema = {
  body: Joi.object({
    slotId: generalrules.id.required().messages({
      "string.hex": "invalid slot id",
      "string.length": "slot id must be 24 characters",
      "any.required": "slot id is required",
    }),
    reason: Joi.string().optional(),
    paymentId: generalrules.id.required().messages({
      "string.hex": "invalid payment id",
      "string.length": "payment id must be 24 characters",
      "any.required": "payment id is required",
    }),
  }).required(),
};

export const releaseReservationSchema = {
  body: Joi.object({
    slotId: generalrules.id.required().messages({
      "string.hex": "invalid slot id",
      "string.length": "slot id must be 24 characters",
      "any.required": "slot id is required",
    }),
  }).required(),
};

export const holdSlotSchema = {
  body: Joi.object({
    slotId: generalrules.id.required().messages({
      "string.hex": "invalid slot id",
      "string.length": "slot id must be 24 characters",
      "any.required": "slot id is required",
    }),
  }).required(),
};