import Joi from "joi";

export const createanswersschema = {
    body: Joi.object({

        specialization: Joi.string()
            .valid("medicine", "dentistry", "physiotherapy")
            .required(),

        answers: Joi.array().items(
            Joi.object({
                questionId: Joi.string().required(),
                answer: Joi.required()
            })
        ).required()

    }).required()
}