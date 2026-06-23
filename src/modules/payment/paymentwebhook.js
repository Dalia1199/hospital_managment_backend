// import paymentmodel from "../../DB/models/paymentmodel";

// export const paymentWebhook = async (req, res, next) => {

//     try {

//         const data = req.query;

//         console.log("WEBHOOK:", data);

//         const payment = await paymentmodel.findOne({
//             orderId: data.orderId
//         });

//         if (!payment) {
//             return res.status(404).send("payment not found");
//         }

//         // prevent double update (IMPORTANT)
//         if (payment.paymentStatus === "paid") {
//             return res.send("already processed");
//         }

//         payment.paymentStatus =
//             data.paymentStatus === "SUCCESS"
//                 ? "paid"
//                 : "failed";

//         payment.transactionId = data.transactionId;

//         await payment.save();

//         return res.send("OK");

//     } catch (err) {
//         next(err);
//     }
// };
import paymentmodel from "../../DB/models/paymentmodel.js";
import crypto from "crypto";
import { KASHIER_API_KEY } from "../../../config/config.service.js";
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

export const paymentWebhook = async (req, res, next) => {
    try {
        const data = req.body;
        console.log("WEBHOOK:", data);

        if (data.signature) {
            const isValid = validateKashierSignature(data, KASHIER_API_KEY);
            if (!isValid) {
                return res.status(400).send("invalid signature");
            }
        }

        const payment = await paymentmodel.findOne({ orderId: data.orderId });
        if (!payment) return res.status(404).send("payment not found");

        if (payment.paymentStatus === "paid") return res.send("already processed");

        payment.paymentStatus = data.paymentStatus === "SUCCESS" ? "paid" : "failed";
        payment.transactionId = data.transactionId || "";
        await payment.save();

        return res.status(200).send("OK");

    } catch (err) {
        next(err);
    }
};

