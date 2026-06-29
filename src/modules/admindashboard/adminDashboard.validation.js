import Joi from "joi";

export const getDashboardSchema = {

    query: Joi.object({

        period: Joi.string().valid(
            "week",
            "month",
            "year"
        ).default("month")

    })

};

export const getPaymentsReportSchema = {

    query: Joi.object({

        page: Joi.number()
            .min(1)
            .default(1),

        limit: Joi.number()
            .min(1)
            .max(100)
            .default(10),

        search: Joi.string()
            .allow("", null),

        status: Joi.string()
            .valid(
                "paid",
                "pending",
                "failed"
            ),

        purpose: Joi.string()
            .valid(
                "appointment",
                "subscription"
            ),

        paymentMethod: Joi.string()
            .allow("", null),

        from: Joi.date(),

        to: Joi.date(),

        sort: Joi.string()
            .valid(
                "amount",
                "-amount",
                "createdAt",
                "-createdAt"
            )
            .default("-createdAt")

    })

};