import { paymentPurposeEnum, paymentStatusEnum } from "../../common/enum/payment.enum.js";
import paymentmodel from "../../DB/models/paymentmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import { getRevenueSummary, getSubscriptionPaymentsSummary, getSubscriptionSummary } from "./doctor_dashboard_helper.js";
export const getDashboard = async (req, res, next) => {
    console.log(req.user.email);
    console.log(req.user._id);
    try {

        const [subscription,revenue,subscriptionPayments] = await Promise.all([

            getSubscriptionSummary({

                doctorId: req.user._id

            }),

            getRevenueSummary({

                doctorId: req.user._id

            }),

            getSubscriptionPaymentsSummary({

                doctorId: req.user._id

            })

        ]);

        return successresponse({

            res,

            message: "Doctor dashboard fetched successfully",

            data: { subscription, revenue, subscriptionPayments}

        });

    }

    catch (error) {

        next(error);

    }

};