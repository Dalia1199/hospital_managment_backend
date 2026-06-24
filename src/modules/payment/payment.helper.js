import crypto from "crypto";
import { KASHIER_API_KEY } from "../../../config/config.service.js";

export const generateKashierHash = ({
    merchantId,
    orderId,
    amount,
    currency
}) => {

    const path =
        `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
    // const path = `${merchantId}.${orderId}.${amount}.${currency}`;
    return crypto
        .createHmac(
            "sha256",
            KASHIER_API_KEY
        )
        .update(path)
        .digest("hex");
};