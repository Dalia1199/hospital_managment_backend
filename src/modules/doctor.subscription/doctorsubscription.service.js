import { paymentPurposeEnum, paymentStatusEnum } from "../../common/enum/payment.enum.js";
import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import * as db_service from "../../DB/db.service.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import doctormodel from "../../DB/models/doctormodel.js";
import paymentmodel from "../../DB/models/paymentmodel.js";
import usermodel from "../../DB/models/usermodel.js";
import { notify } from "../notifications/notification.service.js";
import { generateCheckoutUrl } from "../payment/payment.helper.js";
//tested
// =========================
// GET MY SUBSCRIPTION
// =========================
// done
export const getMySubscription = async (req, res, next) => {

    try {

        const doctorSubscription =

            await db_service.findOne({

                model:

                    doctorSubscriptionModel,

                filter: {

                    doctorId:

                        req.user._id,

                    status:

                        subscriptionStatusEnum.active

                },

                populate: [

                    {

                        path: "subscriptionId"

                    }

                ]

            });

        if (

            !doctorSubscription

        ) {

            throw new Error(

                "No active subscription",

                {

                    cause: 404

                }

            );

        }

        const remainingDays = Math.max(

            0,

            Math.ceil(

                (

                    new Date(

                        doctorSubscription.endDate

                    ) -

                    new Date()

                ) /

                (1000 * 60 * 60 * 24)

            )

        );

        return successresponse({

            res,

            message:

                "subscription fetched successfully",

            data: {

                subscription:

                    doctorSubscription,

                remainingDays

            }

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getAllDoctorSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await db_service.find({

            model: doctorSubscriptionModel,

            populate: [

                {
                    path: "doctorId",

                    select: " email"
                }, {
                    path: "subscriptionId"

                },

                {

                    path: "paymentId"

                }

            ],

            sort: {

                createdAt: -1

            }

        });

        return successresponse({ res, message: "Doctor subscriptions fetched successfully", data: subscriptions });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getDoctorSubscriptionById = async (

    req,

    res,

    next

) => {

    try {

        const {

            subscriptionId

        } = req.params;

        const subscription =

            await db_service.findById({

                model:

                    doctorSubscriptionModel,

                id:

                    subscriptionId,

                populate: [

                    {

                        path: "doctorId",

                        select:

                            "fullname email phone"

                    },

                    {

                        path: "subscriptionId"

                    },

                    {

                        path: "paymentId"

                    }

                ]

            });

        if (

            !subscription

        ) {

            throw new Error(

                "Subscription not found",

                {

                    cause: 404

                }

            );

        }

        return successresponse({

            res,

            message:

                "Subscription fetched successfully",

            data:

                subscription

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const getDoctorSubscriptionByDoctor = async (

    req,

    res,

    next

) => {

    try {

        const {

            doctorId

        } = req.params;

        const subscription =

            await db_service.findOne({

                model:

                    doctorSubscriptionModel,

                filter: {

                    doctorId

                },

                populate: [

                    {

                        path: "doctorId",

                        select:

                            "fullname email phone"

                    },

                    {

                        path: "subscriptionId"

                    },

                    {

                        path: "paymentId"

                    }

                ]

            });

        if (

            !subscription

        ) {

            throw new Error(

                "Doctor subscription not found",

                {

                    cause: 404

                }

            );

        }

        return successresponse({

            res,

            message:

                "Doctor subscription fetched successfully",

            data:

                subscription

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const cancelSubscription = async (req, res, next) => {

    try {

        const { subscriptionId } = req.params;

        const { cancelReason } = req.body;
        // console.log("subscriptionId:", subscriptionId);
let filter={
    _id:subscriptionId
};
if(req.user.role===roleenum.doctor){
    filter.doctorId=req.user._id;
}
        const subscription = await db_service.findOne({

            model:

                doctorSubscriptionModel,

            id:

                subscriptionId
                filter

        });
        // console.log(subscription);
        if (

            !subscription

        ) {

            throw new Error(

                "Subscription not found",

                {

                    cause: 404

                }

            );

        }
        if (

            subscription.status !==

            subscriptionStatusEnum.active

        ) {

            throw new Error(

                "Only active subscriptions can be cancelled",

                {

                    cause: 400

                }

            );

        }

        if (

            subscription.status ===

            subscriptionStatusEnum.cancelled

        ) {

            throw new Error(

                "Subscription already cancelled",

                {

                    cause: 409

                }

            );

        }

        await db_service.findOneAndUpdate({

            model:

                doctorSubscriptionModel,

            filter,

         

            update: {

                status:

                    subscriptionStatusEnum.cancelled,

                cancelledAt:

                    new Date(),

                cancelledBy:

                    req.user._id,

                cancelReason

            }

        });

        return successresponse({

            res,

            message:

                "Subscription cancelled successfully"

        });

    }

    catch (error) {

        next(error);

    }

};
//done
export const renewSubscription = async (req, res, next) => {

    try {
        const { subscriptionId } = req.params;
        const subscription = await db_service.findById({
            model: doctorSubscriptionModel,
            id: subscriptionId,
            populate: [
                {
                    path: "subscriptionId"
                }
            ]
        });

        if (!subscription) throw new Error("Subscription not found", { cause: 404 });
        if (subscription.doctorId.toString() !== req.user._id.toString()) throw new Error("Unauthorized", { cause: 403 });

        const plan = subscription.subscriptionId;
        const formattedAmount = Number(plan.price).toFixed(2);
        const orderId = Date.now().toString();

        const payment = await db_service.create({
            model:
                paymentmodel,
            data: {
                userId: req.user._id,
                amount: formattedAmount,
                purpose: paymentPurposeEnum.subscription,
                referenceId: plan._id,
                orderId,
                paymentStatus: paymentStatusEnum.pending
            }
        });

        const paymentUrl = generateCheckoutUrl({
            orderId,
            amount: formattedAmount,
            metaData: {
                userId: req.user._id,
                purpose: paymentPurposeEnum.subscription,
                referenceId: plan._id
            }
        });

        const admins = await db_service.find({
            model: usermodel,
            filter: { role: roleenum.admin }
        });

        await Promise.all(
            admins.map(admin =>
                notify.subscriptionPlanRenewed(admin._id, req.user.fullName)
            )
        );

        notify.doctorPlanRenewed(req.user._id, formattedAmount);
        notify.doctorPlanRenewed(req.user.fullName);

        return successresponse({
            res,
            message: "Renew payment created successfully",
            data: {
                payment,
                paymentUrl
            }
        });
    }
    catch (error) {
        next(error);
    }
};