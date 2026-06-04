import Joi from "joi";

// add validation for update doctor profile
export const updatedoctorprofileschema = {
    body: Joi.object({
        bio: Joi.string().min(20).max(200).optional(),
        specialization: Joi.string().optional(),
        experience: Joi.number().optional(),
    }).required(),
}
