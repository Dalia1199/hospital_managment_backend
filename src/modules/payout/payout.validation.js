import joi from "joi";

export const setupPayoutProfileSchema = {
    body: joi.object({
        paymentMethod: joi.string().valid('instapay', 'vodafone_cash', 'bank_transfer', 'other').required(),
        accountDetails: joi.string().required(),
    }).required(),
    // Note: idPhoto is handled by multer, we might not strictly validate the file field here depending on the setup, but multer will reject if not present.
};

export const requestPayoutChangeSchema = {
    body: joi.object({
        newPaymentMethod: joi.string().valid('instapay', 'vodafone_cash', 'bank_transfer', 'other').required(),
        newAccountDetails: joi.string().required(),
    }).required(),
};

export const requestPayoutSchema = {
    body: joi.object({
        amount: joi.number().positive().required(),
    }).required(),
};

export const updatePayoutStatusSchema = {
    params: joi.object({
        requestId: joi.string().required()
    }).required(),
    body: joi.object({
        status: joi.string().valid('paid', 'rejected').required(),
        adminNotes: joi.string().allow('').optional()
    }).required()
};

export const updateChangeRequestStatusSchema = {
    params: joi.object({
        requestId: joi.string().required()
    }).required(),
    body: joi.object({
        status: joi.string().valid('approved', 'rejected').required(),
        adminNotes: joi.string().allow('').optional()
    }).required()
};
