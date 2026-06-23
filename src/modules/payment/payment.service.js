
// import appointmentsmodel from "../../DB/models/appointments_model.js";
// import paymentmodel from "../../DB/models/paymentmodel.js";

// import { successresponse } from "../../common/utilits/responce.success.js"

// import * as db_service from "../../DB/db.service.js";
// import doctormodel from "../../DB/models/doctormodel.js";
// import { generateKashierHash } from "./payment.helper.js";
// import { KASHIER_BASE_URL, KASHIER_CALLBACK_URL, KASHIER_MERCHANT_ID } from "../../../config/config.service.js";

// // import { generateKashierHash } from "./payment.helper.js";
// export const createCheckout = async (
//     req,
//     res,
//     next
// ) => {

//     try {

//         const { appointmentId } =
//             req.params;

//         const appointment =
//             await db_service.findOne({

//                 model:
//                     appointmentsmodel,

//                 filter: {

//                     _id:
//                         appointmentId,

//                     patientId:
//                         req.user._id

//                 }

//             });

//         if (!appointment) {

//             throw new Error(
//                 "appointment not found",
//                 { cause: 404 }
//             );

//         }

//         const doctor =
//             await db_service.findOne({

//                 model:
//                     doctormodel,

//                 filter: {

//                     userId:
//                         appointment.doctorId

//                 }

//             });

//         if (!doctor) {

//             throw new Error(
//                 "doctor not found",
//                 { cause: 404 }
//             );

//         }
//         console.log("doctor", doctor);
//         console.log(
//             "consultationFee",
//             doctor.consultationFee
//         );
//         if (
//             !doctor.consultationFee
//         ) {

//             throw new Error(
//                 "doctor consultation fee not found",
//                 { cause: 400 }
//             );

//         }

//         const orderId =
//             Date.now().toString();

//         const payment =
//             await paymentmodel.create({

//                 userId:
//                     req.user._id,

//                 amount:
//                     doctor.consultationFee,

//                 purpose:
//                     "appointment",

//                 referenceId:
//                     appointment._id,

//                 orderId

//             });

//         const hash =
//             generateKashierHash({

//                 merchantId:
//                     KASHIER_MERCHANT_ID,

//                 orderId,

//                 amount:
//                     payment.amount,

//                 currency:
//                     "EGP"

//             });

//         const paymentUrl =

//             `${KASHIER_BASE_URL}?` +

//             `merchantId=${KASHIER_MERCHANT_ID}` +

//             `&orderId=${orderId}` +

//             `&amount=${payment.amount}` +

//             `&currency=EGP` +

//             `&hash=${hash}` +

//             `&merchantRedirect=${KASHIER_CALLBACK_URL}`
//             +
//             `&redirectMethod=get`+
//             `&allowedMethods=card`+
//             `&mode=test`;
//         console.log(paymentUrl);
//         return successresponse({

//             res,

//             message:
//                 "checkout url generated successfully",

//             data: {

//                 payment,

//                 paymentUrl

//             }

//         });

//     } catch (error) {

//         next(error);

//     }

// };
// export const paymentCallback = async (req, res, next) => {

//     try {

//         const data = req.query;

//         const payment = await paymentmodel.findOne({
//             orderId: data.orderId
//         });

//         if (!payment) {
//             return res.status(404).send("payment not found");
//         }

//         if (payment.paymentStatus === "paid") {
//             return res.send("already processed");
//         }

//         payment.paymentStatus =
//             data.paymentStatus === "SUCCESS"
//                 ? "paid"
//                 : "failed";

//         payment.transactionId = data.transactionId;

//         await payment.save();

//         return res.send("payment processed");

//     } catch (err) {
//         next(err);
//     }
// };
import appointmentsmodel from "../../DB/models/appointments_model.js";
import paymentmodel from "../../DB/models/paymentmodel.js";
import { successresponse } from "../../common/utilits/responce.success.js"
import * as db_service from "../../DB/db.service.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { generateKashierHash } from "./payment.helper.js";
import {
    KASHIER_BASE_URL,
    KASHIER_CALLBACK_URL,
    KASHIER_MERCHANT_ID,
    KASHIER_API_KEY  // FIX: محتاجه للـ validateSignature
} from "../../../config/config.service.js";
import crypto from "crypto"; // FIX: محتاجه للـ validateSignature
function validateKashierSignature(query, secret) {
    let queryString =
        "&paymentStatus=" + (query["paymentStatus"] || "") +
        "&cardDataToken=" + (query["cardDataToken"] || "") +
        "&maskedCard=" + (query["maskedCard"] || "") +
        "&merchantOrderId=" + (query["merchantOrderId"] || "") +
        "&orderId=" + (query["orderId"] || "") +
        "&cardBrand=" + (query["cardBrand"] || "") +
        "&orderReference=" + (query["orderReference"] || "") +
        "&transactionId=" + (query["transactionId"] || "") +
        "&amount=" + (query["amount"] || "") +
        "&currency=" + (query["currency"] || "");

    const finalUrl = queryString.substring(1);
    const signature = crypto.createHmac("sha256", secret)
        .update(finalUrl)
        .digest("hex");

    return signature === query.signature;
}

export const createCheckout = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await db_service.findOne({
            model: appointmentsmodel,
            filter: { _id: appointmentId, patientId: req.user._id }
        });
        if (!appointment) {
            throw new Error("appointment not found", { cause: 404 });
        }

        const doctor = await db_service.findOne({
            model: doctormodel,
            filter: { userId: appointment.doctorId }
        });
        if (!doctor) {
            throw new Error("doctor not found", { cause: 404 });
        }
        if (!doctor.consultationFee) {
            throw new Error("doctor consultation fee not found", { cause: 400 });
        }

        const orderId = Date.now().toString();

        const amount = Number(doctor.consultationFee).toFixed(2); // "500.00" مش 500

        const payment = await paymentmodel.create({
            userId: req.user._id,
            amount: amount,          
            purpose: "appointment",
            referenceId: appointment._id,
            orderId
        });

        
        const hash = generateKashierHash({
            merchantId: KASHIER_MERCHANT_ID,
            orderId,
            amount: amount,     
            currency: "EGP"
        });

        const metaData = JSON.stringify({
            "Patient ID": req.user._id.toString(),
            "Appointment ID": appointment._id.toString(),
            "Doctor": doctor._id.toString()
        });

        const paymentUrl =
            `${KASHIER_BASE_URL}?` +
            `merchantId=${KASHIER_MERCHANT_ID}` +
            `&orderId=${orderId}` +
            `&amount=${amount}` +       
            `&currency=EGP` +
            `&hash=${hash}` +
            `&merchantRedirect=${encodeURIComponent(KASHIER_CALLBACK_URL)}` + // FIX: encode
            `&redirectMethod=get` +
            `&allowedMethods=card` +
            `&metaData=${encodeURIComponent(metaData)}` 
            `&mode=test`;

        console.log({
            merchantId: KASHIER_MERCHANT_ID,
            orderId,
            amount,
            hash,
            paymentUrl
        });
        return successresponse({
            res,
            message: "checkout url generated successfully",
            data: { payment, paymentUrl }
        });

    } catch (error) {
        next(error);
    }
};

export const paymentCallback = async (req, res, next) => {
    try {
        console.log("================================");
        console.log("PAYMENT CALLBACK HIT");
        console.log("METHOD:", req.method);
        console.log("QUERY:", req.query);
        console.log("BODY:", req.body);
        console.log("================================");
        const data = { ...req.query, ...req.body };

        console.log("Kashier Callback data:", data);

        if (data.signature) {
            const isValid = validateKashierSignature(data, KASHIER_API_KEY);
            if (!isValid) {
                console.error("Invalid Kashier signature!");
                return res.status(400).send("invalid signature");
            }
        }

        if (!data.orderId) {
            return res.status(400).send("missing orderId");
        }

        const payment = await paymentmodel.findOne({ orderId: data.orderId });
        if (!payment) {
            return res.status(404).send("payment not found");
        }

        if (payment.paymentStatus === "paid") {
            return res.redirect("/payment/success"); // أو أي route عندك
        }

        payment.paymentStatus = data.paymentStatus === "SUCCESS" ? "paid" : "failed";
        payment.transactionId = data.transactionId || "";
        await payment.save();

        if (payment.paymentStatus === "paid") {
            return res.redirect("/payment/success");
        } else {
            return res.redirect("/payment/failed");
        }

    } catch (err) {
        next(err);
    }
};

