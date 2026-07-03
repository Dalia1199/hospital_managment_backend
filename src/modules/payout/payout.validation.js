import joi from "joi";

export const requestPayoutSchema = {
    body: joi.object({
        amount: joi.number().positive().required(),
        paymentMethod: joi.string().valid('instapay', 'vodafone_cash', 'bank_transfer', 'other').required(),
        paymentDetails: joi.string().required(),
    }).required(),
};

export const updatePayoutStatusSchema = {
    params: joi.object({
        requestId: joi.string().required()
    }).required(),
    body: joi.object({
        status: joi.string().valid('paid', 'rejected').required(),
        adminNotes: joi.string().optional()
    }).required()
};
