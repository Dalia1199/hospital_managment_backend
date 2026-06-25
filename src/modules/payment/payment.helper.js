

import crypto from "crypto";

import {
    KASHIER_API_KEY,
    KASHIER_MERCHANT_ID,
    KASHIER_BASE_URL,
    KASHIER_CALLBACK_URL
} from "../../../config/config.service.js";


export const generateHash = ({ orderId, amount, currency }) => {
    const formatted = Number(amount).toFixed(2);

    const path = `/?payment=${KASHIER_MERCHANT_ID}.${orderId}.${formatted}.${currency}`;

    return crypto
        .createHmac("sha256", KASHIER_API_KEY)
        .update(path)
        .digest("hex");
};

// =========================
// CHECKOUT URL
// =========================
export const generateCheckoutUrl = ({
    orderId,
    amount,
    metaData = {}
}) => {
    const formatted = Number(amount).toFixed(2);

    const hash = generateHash({
        orderId,
        amount: formatted,
        currency: "EGP"
    });

    return (
        `${KASHIER_BASE_URL}/?` +
        `merchantId=${KASHIER_MERCHANT_ID}` +
        `&orderId=${orderId}` +
        `&amount=${formatted}` +
        `&currency=EGP` +
        `&hash=${hash}` +
        `&merchantRedirect=${encodeURIComponent(KASHIER_CALLBACK_URL)}` +
        `&redirectMethod=get` +
        `&metaData=${encodeURIComponent(JSON.stringify(metaData))}`
    );
};


export const normalizeStatus = (status) => {
    if (!status) return "pending";

    const s = status.toLowerCase();

    if (["success", "paid", "captured"].includes(s)) return "paid";
    if (["failed", "declined", "cancelled"].includes(s)) return "failed";

    return "pending";
};