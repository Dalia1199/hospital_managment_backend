

import paymentmodel from "../../DB/models/paymentmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";

import {
    KASHIER_API_KEY
} from "../../../config/config.service.js";




import { generateCheckoutUrl, normalizeStatus, verifyKashierSignature } from "./payment.helper.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import subscriptionmodel from "../../DB/models/subscriptionmodel.js";
import usermodel from "../../DB/models/usermodel.js";
import { roleenum } from "../../common/enum/user.enum.js";
import { notify } from "../notifications/notification.service.js";

// =========================
// CREATE PAYMENT (GENERIC)
// =========================
// export const createCheckout = async (req, res, next) => {
//     try {
//         const {
//             amount,
//             purpose,
//             referenceId,
//             paymentMethod = "card"
//         } = req.body;

//         const paidPayment = await paymentmodel.findOne({
//             purpose,
//             referenceId,
//             paymentStatus: "paid"
//         });

//         if (paidPayment) {
//             throw new Error("already paid");
//         }
//         const orderId = Date.now().toString();

//         const payment = await paymentmodel.create({
//             userId: req.user._id,
//             amount,
//             purpose,
//             referenceId,
//             orderId,
//             paymentMethod,
//             paymentStatus: "pending"
//         });

//         const paymentUrl = generateCheckoutUrl({
//             orderId,
//             amount,
//             metaData: {
//                 userId: req.user._id,
//                 purpose,
//                 referenceId
//             }
//         });

//         successresponse({
//             res,
//             message: "done",
//             data: {
//                 payment,
//                 paymentUrl
//             }
//         });
//     } catch (err) {
//         next(err);
//     }
// };
export const createCheckout = async (
    req,
    res,
    next
) => {

    try {

        let {
            amount,
            purpose,
            referenceId,
            paymentMethod = "card"
        } = req.body;



        const paidPayment =
            await paymentmodel.findOne({

                userId: req.user._id,

                purpose,

                referenceId,

                paymentStatus: "paid"

            });

        if (paidPayment && purpose !== "subscription") {

            throw new Error(
                "this item is already paid"
            );

        }

        // =========================
        // Appointment Payment
        // =========================

        if (
            purpose === "appointment"
        ) {

            const appointment =
                await appointmentsmodel.findById(
                    referenceId
                );

            if (!appointment) {

                throw new Error(
                    "appointment not found"
                );

            }

            const doctor =
                await doctormodel.findOne({

                    userId:
                        appointment.doctorId

                });

            if (!doctor) {

                throw new Error(
                    "doctor not found"
                );

            }

            amount =
                doctor.consultationFee;

        }

        // =========================
        // Follow-up Payment
        // =========================

        if (purpose === "followup") {
            const appointment = await appointmentsmodel.findById(referenceId);

            if (!appointment) {
                throw new Error("appointment not found");
            }
            if (!appointment.isFollowUp) {
                throw new Error("this appointment is not a follow-up consultation");
            }

            const doctor = await doctormodel.findOne({ userId: appointment.doctorId });

            if (!doctor) {
                throw new Error("doctor not found");
            }

            amount = doctor.followUpFee ?? (doctor.consultationFee * 0.5);
        }

        // =========================
        // Subscription Payment
        // =========================

        if (

            purpose === "subscription"

        ) {

            const plan =

                await subscriptionmodel.findById(

                    referenceId

                );

            if (

                !plan

            ) {

                throw new Error(

                    "subscription plan not found"

                );

            }

            if (

                !plan.isActive

            ) {

                throw new Error(

                    "subscription plan is not available"

                );

            }


        const activeSubscription =

            await doctorSubscriptionModel.findOne({

                doctorId:

                    req.user._id,

                status:

                    subscriptionStatusEnum.active

            });

        // if (activeSubscription) {
        //     throw new Error("you already have an active subscription");
        // }

        amount =

            plan.price;

    }

        const formattedAmount =
        Number(amount).toFixed(2);

    const orderId =
        Date.now().toString();

    const payment =
        await paymentmodel.create({

            userId:
                req.user._id,

            amount:
                formattedAmount,

            purpose,

            referenceId,

            orderId,

            paymentMethod,

            paymentStatus:
                "pending"

        });

    const paymentUrl =
        generateCheckoutUrl({

            orderId,

            amount:
                formattedAmount,

            metaData: {

                userId:
                    req.user._id,

                purpose,

                referenceId

            }

        });



    return successresponse({

        res,

        message:
            "checkout created successfully",

        data: {

            payment,

            paymentUrl

        }

    });

} catch (error) {

    next(error);

}

};

export const paymentCallback = async (req, res, next) => {
    try {
        const data = req.query;

        // DEBUG: Log exact data from Kashier to a file
        import('fs').then(fs => fs.appendFileSync('kashier-debug.log', JSON.stringify({ time: new Date(), query: data }) + '\n'));

        if (!verifyKashierSignature(data)) {
            const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
            return res.redirect(`${FRONTEND_URL}/subscription-success?status=failed&error=invalid_signature`);
        }

        const orderId = data.merchantOrderId || data.orderId;
        const payment = await paymentmodel.findOne({
            orderId: orderId
        });

        if (!payment) return res.status(404).send("not found");

        if (payment.paymentStatus === "paid") {
            if (payment.purpose === "appointment" || payment.purpose === "followup") {
                await appointmentsmodel.findByIdAndUpdate(
                    payment.referenceId,
                    {
                        paymentStatus: "paid"
                    }
                );
            }
            return res.send("already processed");
        }

        payment.transactionId = data.transactionId;
        payment.paymentMethod = data.paymentMethod || "card";
        
        // Set payment status based entirely on Kashier's response
        payment.paymentStatus = normalizeStatus(data.paymentStatus);

        await payment.save();

        if (
            (payment.purpose === "appointment" || payment.purpose === "followup") &&
            payment.paymentStatus === "paid"
        ) {
            const appointment = await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                {
                    paymentStatus: "paid"
                },
                { new: true }
            );

            if (appointment) {
                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const { doctorShare, platformFee } = await calculateCommission(payment.amount);
                
                await addPendingBalance(appointment.doctorId, doctorShare, payment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid: payment.amount 
                });
            }
        }

        if (
            payment.purpose === "subscription" &&
            payment.paymentStatus === "paid"
        ) {
            const plan = await subscriptionmodel.findById(payment.referenceId);
            if (!plan) throw new Error("subscription plan not found");

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + plan.durationInDays);

            const doctorSubscription = await db_service.findOne({
                model: doctorSubscriptionModel,
                filter: { doctorId: payment.userId }
            });

            if (doctorSubscription) {
                await db_service.findOneAndUpdate({
                    model: doctorSubscriptionModel,
                    filter: { _id: doctorSubscription._id },
                    update: {
                        $set: {
                            subscriptionId: plan._id,
                            paymentId: payment._id,
                            startDate,
                            endDate,
                            status: subscriptionStatusEnum.active
                        },
                        $unset: { cancelReason: 1, cancelledAt: 1, cancelledBy: 1 }
                    }
                });
            } else {
                await db_service.create({
                    model: doctorSubscriptionModel,
                    data: {
                        doctorId: payment.userId,
                        subscriptionId: plan._id,
                        paymentId: payment._id,
                        startDate,
                        endDate,
                        status: subscriptionStatusEnum.active
                    }
                });
            }

            // --- Defer enforcement to frontend ---
            // The frontend GlobalClinicLimitGuard will detect excess clinics and force the user to choose.

            const user = await db_service.findById({ model: usermodel, id: payment.userId });
            const admins = await db_service.find({ model: usermodel, filter: { role: roleenum.admin } });
            
            if (user) {
                await Promise.all(
                    admins.map(admin => notify.subscriptionPlanPaid(admin._id, user.fullName))
                );
            }
            notify.doctorPlanPaid(payment.userId, payment.amount);
        }

        const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
        if (payment.purpose === "subscription") {
            return res.redirect(`${FRONTEND_URL}/subscription-success?status=${payment.paymentStatus}`);
        } else {
            return res.redirect(`${FRONTEND_URL}/payments/callback?paymentStatus=${payment.paymentStatus}&merchantOrderId=${orderId}`);
        }
    } catch (err) {
        next(err);
    }
};

export const payWithWallet = async (req, res, next) => {
    try {
        const { purpose, referenceId } = req.body;
        let amount = req.body.amount;
        const userId = req.user._id;

        if (purpose === "appointment" || purpose === "followup") {
            const appointment = await appointmentsmodel.findById(referenceId);
            if (!appointment) throw new Error("appointment not found");
            const doctor = await doctormodel.findOne({ userId: appointment.doctorId });
            if (!doctor) throw new Error("doctor not found");
            
            amount = purpose === "appointment" ? doctor.fees : doctor.followUpFees;
            
            if (appointment.paymentStatus === "paid") {
                throw new Error("appointment already paid");
            }
        } else {
            throw new Error("Invalid purpose for wallet payment");
        }

        const { deductAvailableBalance } = await import('../wallet/wallet.service.js');
        await deductAvailableBalance(userId, amount, 'online_booking_payment', referenceId);

        // Update appointment status to paid
        const appointment = await appointmentsmodel.findByIdAndUpdate(
            referenceId,
            { paymentStatus: "paid" },
            { new: true }
        );

        if (appointment) {
            const { calculateCommission } = await import('../appconfig/appconfig.service.js');
            const { addPendingBalance } = await import('../wallet/wallet.service.js');
            const { doctorShare, platformFee } = await calculateCommission(amount);
            
            await addPendingBalance(appointment.doctorId, doctorShare, referenceId, { 
                platformFee, 
                doctorShare, 
                totalPaid: amount,
                paymentMethod: 'wallet'
            });
        }

        return successresponse({
            res,
            message: "Payment via wallet successful",
            data: { status: "paid" }
        });

    } catch (error) {
        next(error);
    }
};


export const paymentWebhook = async (req, res, next) => {
    try {
        const data = req.body;

        if (!verifyKashierSignature(data)) {
            return res.status(403).send("Invalid signature");
        }

        const orderId = data.merchantOrderId || data.orderId;
        const payment = await paymentmodel.findOne({
            orderId: orderId
        });

        if (!payment) return res.status(404).send("not found");

        if (payment.paymentStatus === "paid") {
            if (payment.purpose === "appointment" || payment.purpose === "followup") {
                await appointmentsmodel.findByIdAndUpdate(
                    payment.referenceId,
                    {
                        paymentStatus: "paid"
                    }
                );
            }
            return res.json({ ok: true });
        }

        payment.transactionId = data.transactionId;
        payment.paymentMethod = data.paymentMethod || "unknown";
        payment.paymentStatus = normalizeStatus(data.paymentStatus);

        await payment.save();
        if (
            (payment.purpose === "appointment" || payment.purpose === "followup") &&
            payment.paymentStatus === "paid"
        ) {
            const appointment = await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                {
                    paymentStatus: "paid"
                },
                { new: true }
            );

            if (appointment) {
                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const { doctorShare, platformFee } = await calculateCommission(payment.amount);
                
                await addPendingBalance(appointment.doctorId, doctorShare, payment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid: payment.amount 
                });
            }
        }
        // =========================
        // Subscription
        // =========================

        if (

            payment.purpose === "subscription" &&

            payment.paymentStatus === "paid"

        ) {

            const plan =

                await subscriptionmodel.findById(

                    payment.referenceId

                );

            if (

                !plan

            ) {

                throw new Error(

                    "subscription plan not found"

                );

            }

            const startDate =

                new Date();

            const endDate =

                new Date();

            endDate.setDate(

                endDate.getDate() +

                plan.durationInDays

            );

            const doctorSubscription =
                await db_service.findOne({

                    model:

                        doctorSubscriptionModel,

                    filter: {

                        doctorId:

                            payment.userId

                    }

                });

            // if (

            //     doctorSubscription

            // ) {

            //     doctorSubscription.subscriptionId =

            //         plan._id;

            //     doctorSubscription.paymentId =

            //         payment._id;

            //     doctorSubscription.startDate =

            //         startDate;

            //     doctorSubscription.endDate =

            //         endDate;

            //     doctorSubscription.status =

            //         subscriptionStatusEnum.active;

            //     await doctorSubscription.save();

            // }
            if (doctorSubscription) {
                await db_service.findOneAndUpdate({
                    model: doctorSubscriptionModel,
                    filter: { _id: doctorSubscription._id },
                    update: {
                        $set: {
                            subscriptionId: plan._id,
                            paymentId: payment._id,
                            startDate,
                            endDate,
                            status: subscriptionStatusEnum.active
                        },
                        $unset: { cancelReason: 1, cancelledAt: 1, cancelledBy: 1 }
                    }
                });
            } else {
                await db_service.create({
                    model: doctorSubscriptionModel,
                    data: {
                        doctorId: payment.userId,
                        subscriptionId: plan._id,
                        paymentId: payment._id,
                        startDate,
                        endDate,
                        status: subscriptionStatusEnum.active
                    }
                });
            }

            const user = await db_service.findById({ model: usermodel, id: payment.userId });
            const admins = await db_service.find({ model: usermodel, filter: { role: roleenum.admin } });
            
            if (user) {
                await Promise.all(
                    admins.map(admin => notify.subscriptionPlanPaid(admin._id, user.fullName))
                );
            }
            notify.doctorPlanPaid(payment.userId, payment.amount);
        }

            successresponse({
                res,
                message: "done already"
            });
        } catch (err) {
            next(err);
        }
    };
