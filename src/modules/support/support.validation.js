import joi from "joi";

export const submitMessageSchema = {
    body: joi.object({
        firstName: joi.string().required().min(2).max(50),
        lastName: joi.string().required().min(2).max(50),
        email: joi.string().email().required(),
        phone: joi.string().required().pattern(/^[0-9+]+$/),
        subject: joi.string().required().min(3).max(150),
        message: joi.string().required().min(10).max(2000)
    }).required()
};

export const messageIdSchema = {
    params: joi.object({
        messageId: joi.string().hex().length(24).required()
    }).required()
};
