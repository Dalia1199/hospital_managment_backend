import Joi from "joi";

export const answersSchema = {
    body: Joi.object({
        patientId: Joi.string().optional(),

        answers: Joi.array().items(
            Joi.object({
                questionId: Joi.string().required(),
                answer: Joi.required()
            })
        ).required()
    }).required()
};

export const getAnswersSchema = {
    params: Joi.object({
        patientId: Joi.string().required()
    }).required()
};