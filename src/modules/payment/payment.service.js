

import paymentmodel from "../../DB/models/paymentmodel.js";
import * as db_service from "../../DB/db.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import dayjs from "dayjs";

import {
    KASHIER_API_KEY
} from "../../../config/config.service.js";




import { generateCheckoutUrl, normalizeStatus, verifyKashierSignature } from "./payment.helper.js";
import appointmentsmodel from "../../DB/models/appointments_model.js";
import doctormodel from "../../DB/models/doctormodel.js";
import slotmodel from "../../DB/models/slot_model.js";
import { subscriptionStatusEnum } from "../../common/enum/subscription.enum.js";
import doctorSubscriptionModel from "../../DB/models/doctor.subscription.js";
import clinicmodel from "../../DB/models/clinic_model.js";
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
            paymentMethod = "card",
            useWallet
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

            const slot = await slotmodel.findById(referenceId);
            if (!slot) throw new Error("slot not found");

            const clinic = await clinicmodel.findById(slot.clinicId);
            if (!clinic) throw new Error("clinic not found");

            let isFollowUp = false;
            const validFollowUp = await appointmentsmodel.findOne({
              patientId: req.user._id,
              doctorId: slot.doctorId,
              status: "completed",
              followUpStatus: { $in: ["scheduled", "overridden"] }
            }).sort({ createdAt: -1 });

            if (validFollowUp) {
              const bookingDate = dayjs(slot.startDateTime);
              const deadline = dayjs(validFollowUp.followUpDeadline);
              
              if (validFollowUp.followUpStatus === "overridden" || bookingDate.isBefore(deadline) || bookingDate.isSame(deadline, 'day')) {
                 isFollowUp = true;
              }
            }

            const doctor = await doctormodel.findOne({ userId: slot.doctorId });
            if (!doctor) throw new Error("doctor not found");
            
            const baseFee = clinic.consultationFee || 0;
            const followUpFee = clinic.followUpFee ?? (baseFee * 0.5);
            amount = isFollowUp ? followUpFee : baseFee;
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

            const clinic = await clinicmodel.findById(appointment.clinicId);
            if (!clinic) throw new Error("clinic not found");

            amount = clinic.followUpFee ?? (clinic.consultationFee * 0.5);
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

        let walletDeduction = 0;
        if (useWallet) {
            const { getWallet } = await import('../wallet/wallet.service.js');
            const wallet = await getWallet(req.user._id);
            if (wallet.availableBalance >= amount) {
                throw new Error("Wallet balance is sufficient to cover the full amount, please use pay-with-wallet instead.");
            }
            if (wallet.availableBalance > 0) {
                walletDeduction = wallet.availableBalance;
                amount = amount - walletDeduction;
            }
        }

        const formattedAmount =
            Number(amount).toFixed(2);

        const orderId =
            Date.now().toString();

        const payment =
            await paymentmodel.create({
                userId: req.user._id,
                amount: formattedAmount,
                purpose,
                referenceId,
                orderId,
                paymentMethod,
                walletDeduction,
                paymentStatus: "pending"
            });

    const paymentUrl =
        generateCheckoutUrl({
            orderId,
            amount: formattedAmount,
            metaData: {
                userId: req.user._id,
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
        console.log("[paymentCallback] Data received:", data);

        if (!verifyKashierSignature(data)) {
            const FRONTEND_URL = process.env.FRONTEND_URL || "https://carehub-two.vercel.app";
            return res.redirect(`${FRONTEND_URL}/subscription-success?status=failed&error=invalid_signature&kashierStatus=${data.paymentStatus}`);
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
            const FRONTEND_URL = process.env.FRONTEND_URL || "https://carehub-two.vercel.app";
            if (payment.purpose === "subscription") {
                return res.redirect(`${FRONTEND_URL}/subscription-success?status=paid`);
            } else {
                return res.redirect(`${FRONTEND_URL}/payments/callback?paymentStatus=paid&merchantOrderId=${orderId}`);
            }
        }

        payment.transactionId = data.transactionId;
        payment.paymentMethod = data.paymentMethod || "card";
        
        // Set payment status based entirely on Kashier's response
        payment.paymentStatus = normalizeStatus(data.paymentStatus || data.status);

        await payment.save();

        if (
            payment.purpose === "appointment" &&
            payment.paymentStatus === "paid"
        ) {
            const slotId = payment.referenceId;
            const slot = await slotmodel.findById(slotId);
            if (!slot || slot.isBooked) {
                console.error("Slot already booked or not found after payment");
            } else {
                if (payment.walletDeduction > 0) {
                    const { deductAvailableBalance } = await import('../wallet/wallet.service.js');
                    await deductAvailableBalance(payment.userId, payment.walletDeduction, 'split_payment_deduction', payment._id);
                }
                const totalPaid = Number(payment.amount) + Number(payment.walletDeduction || 0);

                let isFollowUp = false;
                let parentAppointmentId = null;

                const validFollowUp = await appointmentsmodel.findOne({
                  patientId: payment.userId,
                  doctorId: slot.doctorId,
                  status: "completed",
                  followUpStatus: { $in: ["scheduled", "overridden"] }
                }).sort({ createdAt: -1 });

                if (validFollowUp) {
                  const bookingDate = dayjs(slot.startDateTime);
                  const deadline = dayjs(validFollowUp.followUpDeadline);
                  
                  if (validFollowUp.followUpStatus === "overridden" || bookingDate.isBefore(deadline) || bookingDate.isSame(deadline, 'day')) {
                     isFollowUp = true;
                     parentAppointmentId = validFollowUp._id;
                  } else if (validFollowUp.followUpStatus === "scheduled") {
                     validFollowUp.followUpStatus = "expired";
                     await validFollowUp.save();
                  }
                }

                const appointment = await appointmentsmodel.create({
                    doctorId: slot.doctorId,
                    patientId: payment.userId,
                    clinicId: slot.clinicId,
                    slotId: slot._id,
                    appointmentDate: slot.startDateTime,
                    startDateTime: slot.startDateTime,
                    endDateTime: slot.endDateTime,
                    paymentStatus: 'paid',
                    status: 'booked',
                    isFollowUp,
                    parentAppointmentId,
                    paidAmount: totalPaid
                });

                if (isFollowUp && parentAppointmentId) {
                   await appointmentsmodel.findByIdAndUpdate(parentAppointmentId, {
                       followUpStatus: "used"
                   });
                }

                slot.isBooked = true;
                slot.isReserved = false;
                await slot.save();

                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const { doctorShare, platformFee } = await calculateCommission(totalPaid, appointment.doctorId);
                
                await addPendingBalance(appointment.doctorId, doctorShare, appointment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid,
                    paymentId: payment._id
                });
            }
        } else if (
            payment.purpose === "followup" &&
            payment.paymentStatus === "paid"
        ) {
            const appointment = await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                { paymentStatus: "paid" },
                { new: true }
            );

            if (appointment) {
                const totalPaid = Number(payment.amount) + Number(payment.walletDeduction || 0);
                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const platformledgermodel = (await import('../../DB/models/platform_ledger_model.js')).default;
                
                const { doctorShare, platformFee } = await calculateCommission(totalPaid, appointment.doctorId);
                
                await addPendingBalance(appointment.doctorId, doctorShare, appointment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid,
                    paymentId: payment._id
                });
                
                if (platformFee > 0) {
                    await platformledgermodel.create({
                        amount: platformFee,
                        source: 'appointment',
                        referenceId: payment._id,
                        appointmentId: appointment._id,
                        doctorId: appointment.doctorId,
                        patientId: appointment.patientId
                    });
                }
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

            // ✅ Record subscription revenue in platform ledger
            const platformledgermodel = (await import('../../DB/models/platform_ledger_model.js')).default;
            await platformledgermodel.create({
                amount: payment.amount,
                source: 'subscription',
                referenceId: payment._id,
                doctorId: payment.userId
            });
        }

        const FRONTEND_URL = process.env.FRONTEND_URL || "https://carehub-two.vercel.app";
        if (payment.purpose === "subscription") {
            return res.redirect(`${FRONTEND_URL}/subscription-success?status=${payment.paymentStatus}&kashierStatus=${data.paymentStatus}`);
        } else {
            return res.redirect(`${FRONTEND_URL}/payments/callback?paymentStatus=${payment.paymentStatus}&kashierStatus=${data.paymentStatus}&merchantOrderId=${orderId}`);
        }
    } catch (err) {
        console.error("[paymentCallback] Error:", err);
        const FRONTEND_URL = process.env.FRONTEND_URL || "https://carehub-two.vercel.app";
        const orderId = req.query?.merchantOrderId || req.query?.orderId;
        
        try {
            const payment = await paymentmodel.findOne({ orderId });
            if (payment?.purpose === "subscription") {
                return res.redirect(`${FRONTEND_URL}/subscription-success?status=error&message=callback_error`);
            }
        } catch (e) {
            console.error("[paymentCallback] Failed to fetch payment in error handler:", e);
        }

        return res.redirect(`${FRONTEND_URL}/payments/callback?paymentStatus=error&merchantOrderId=${orderId}&message=callback_error`);
    }
};

export const payWithWallet = async (req, res, next) => {
    try {
        const { purpose, referenceId } = req.body;
        let amount = req.body.amount;
        const userId = req.user._id;

        if (purpose === "appointment") {
            const slot = await slotmodel.findById(referenceId);
            if (!slot || slot.isBooked) throw new Error("Slot not found or already booked");
            const clinic = await clinicmodel.findById(slot.clinicId);
            if (!clinic) throw new Error("clinic not found");
            
            let isFollowUp = false;
            let parentAppointmentId = null;

            const validFollowUp = await appointmentsmodel.findOne({
              patientId: userId,
              doctorId: slot.doctorId,
              status: "completed",
              followUpStatus: { $in: ["scheduled", "overridden"] }
            }).sort({ createdAt: -1 });

            if (validFollowUp) {
              const bookingDate = dayjs(slot.startDateTime);
              const deadline = dayjs(validFollowUp.followUpDeadline);
              
              if (validFollowUp.followUpStatus === "overridden" || bookingDate.isBefore(deadline) || bookingDate.isSame(deadline, 'day')) {
                 isFollowUp = true;
                 parentAppointmentId = validFollowUp._id;
              } else if (validFollowUp.followUpStatus === "scheduled") {
                 validFollowUp.followUpStatus = "expired";
                 await validFollowUp.save();
              }
            }
            
            const baseFee = clinic.consultationFee || 0;
            const followUpFee = clinic.followUpFee ?? (baseFee * 0.5);
            amount = isFollowUp ? followUpFee : baseFee;

            const { deductAvailableBalance } = await import('../wallet/wallet.service.js');
            await deductAvailableBalance(userId, amount, 'online_booking_payment', referenceId);

            const appointment = await appointmentsmodel.create({
                doctorId: slot.doctorId,
                patientId: userId,
                clinicId: slot.clinicId,
                slotId: slot._id,
                appointmentDate: slot.startDateTime,
                startDateTime: slot.startDateTime,
                endDateTime: slot.endDateTime,
                paymentStatus: 'paid',
                status: 'booked',
                isFollowUp,
                parentAppointmentId,
                paidAmount: amount
            });

            if (isFollowUp && parentAppointmentId) {
               await appointmentsmodel.findByIdAndUpdate(parentAppointmentId, {
                   followUpStatus: "used"
               });
            }

            slot.isBooked = true;
            slot.isReserved = false;
            await slot.save();

            const { calculateCommission } = await import('../appconfig/appconfig.service.js');
            const { addPendingBalance } = await import('../wallet/wallet.service.js');
            const { doctorShare, platformFee } = await calculateCommission(amount, appointment.doctorId);
            
            await addPendingBalance(appointment.doctorId, doctorShare, appointment._id, { 
                platformFee, 
                doctorShare, 
                totalPaid: amount,
                paymentMethod: 'wallet'
            });
        } else if (purpose === "followup") {
            const appointment = await appointmentsmodel.findById(referenceId);
            if (!appointment) throw new Error("appointment not found");
            const clinic = await clinicmodel.findById(appointment.clinicId);
            if (!clinic) throw new Error("clinic not found");

            amount = clinic.followUpFee ?? (clinic.consultationFee * 0.5);
            
            if (appointment.paymentStatus === "paid") {
                throw new Error("appointment already paid");
            }

            const { deductAvailableBalance } = await import('../wallet/wallet.service.js');
            await deductAvailableBalance(userId, amount, 'online_booking_payment', referenceId);

            await appointmentsmodel.findByIdAndUpdate(
                referenceId,
                { paymentStatus: "paid" }
            );

            const { calculateCommission } = await import('../appconfig/appconfig.service.js');
            const { addPendingBalance } = await import('../wallet/wallet.service.js');
            const { doctorShare, platformFee } = await calculateCommission(amount, appointment.doctorId);
            
            await addPendingBalance(appointment.doctorId, doctorShare, referenceId, { 
                platformFee, 
                doctorShare, 
                totalPaid: amount,
                paymentMethod: 'wallet'
            });
        } else {
            throw new Error("Invalid purpose for wallet payment");
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
        console.log("[paymentWebhook] Data received:", data);

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
            payment.purpose === "appointment" &&
            payment.paymentStatus === "paid"
        ) {
            const slotId = payment.referenceId;
            const slot = await slotmodel.findById(slotId);
            if (!slot || slot.isBooked) {
                console.error("Slot already booked or not found after payment");
            } else {
                if (payment.walletDeduction > 0) {
                    const { deductAvailableBalance } = await import('../wallet/wallet.service.js');
                    await deductAvailableBalance(payment.userId, payment.walletDeduction, 'split_payment_deduction', payment._id);
                }
                const appointment = await appointmentsmodel.create({
                    doctorId: slot.doctorId,
                    patientId: payment.userId,
                    clinicId: slot.clinicId,
                    slotId: slot._id,
                    appointmentDate: slot.startDateTime,
                    startDateTime: slot.startDateTime,
                    endDateTime: slot.endDateTime,
                    paymentStatus: 'paid',
                    status: 'booked'
                });
                slot.isBooked = true;
                slot.isReserved = false;
                await slot.save();

                const totalPaid = Number(payment.amount) + Number(payment.walletDeduction || 0);
                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const { doctorShare, platformFee } = await calculateCommission(totalPaid, appointment.doctorId);
                
                await addPendingBalance(appointment.doctorId, doctorShare, appointment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid,
                    paymentId: payment._id
                });
            }
        } else if (
            payment.purpose === "followup" &&
            payment.paymentStatus === "paid"
        ) {
            const appointment = await appointmentsmodel.findByIdAndUpdate(
                payment.referenceId,
                { paymentStatus: "paid" },
                { new: true }
            );

            if (appointment) {
                const totalPaid = Number(payment.amount) + Number(payment.walletDeduction || 0);
                const { calculateCommission } = await import('../appconfig/appconfig.service.js');
                const { addPendingBalance } = await import('../wallet/wallet.service.js');
                const { doctorShare, platformFee } = await calculateCommission(totalPaid, appointment.doctorId);
                
                await addPendingBalance(appointment.doctorId, doctorShare, appointment._id, { 
                    platformFee, 
                    doctorShare, 
                    totalPaid,
                    paymentId: payment._id
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
            console.error("[paymentWebhook] Error:", err);
            next(err);
        }
    };
