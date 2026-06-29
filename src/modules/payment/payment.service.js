

import paymentmodel from "../../DB/models/paymentmodel.js";
import * as db_service from "../../DB/db.service.js";
import {  successresponse} from "../../common/utilits/responce.success.js";

import {
    KASHIER_API_KEY
} from "../../../config/config.service.js";




import { generateCheckoutUrl, normalizeStatus } from "./payment.helper.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import doctormodel from "../../DB/models/doctormodel.js";

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

                purpose,

                referenceId,

                paymentStatus: "paid"

            });

        if (paidPayment) {

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
        // Subscription Payment
        // =========================

        // if (
        //     purpose === "subscription"
        // ) {
// subscribtionmodel:to be 

        // }

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

        const payment = await paymentmodel.findOne({
            orderId: data.orderId
        });

        if (!payment) return res.status(404).send("not found");

        if (payment.paymentStatus === "paid") {
            if (payment.purpose === "appointment") {
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
        payment.paymentStatus = normalizeStatus(data.paymentStatus);

        await payment.save();

        if (
            payment.purpose === "appointment" &&
            payment.paymentStatus === "paid"
        ) {
            await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                {
                    paymentStatus: "paid"
                }
            );
        }

successresponse({
        res,
        message: "Payment proceeded"
    });
    } catch (err) {
        next(err);
    }
};


export const paymentWebhook = async (req, res, next) => {
    try {
        const data = req.body;

        const payment = await paymentmodel.findOne({
            orderId: data.orderId
        });

        if (!payment) return res.status(404).send("not found");

        if (payment.paymentStatus === "paid") {
            if (payment.purpose === "appointment") {
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
            payment.purpose === "appointment" &&
            payment.paymentStatus === "paid"
        ) {

            await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                {
                    paymentStatus: "paid"
                }
            );

        }

successresponse({
        res,
        message: "done already"
    });
    } catch (err) {
        next(err);
    }
};
