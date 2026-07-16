
import crypto from "node:crypto";

// Must be 32 byte key
const encryption_key = crypto
    .createHash("sha256")
    .update("123456789123456789123456789$#@de")
    .digest();

const IV_LENGTH = 16;

export function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        encryption_key,
        iv
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text) {
    try {
        if (!text || !text.includes(":")) return text;
        const [ivHex, encryptedText] = text.split(":");
        if (!ivHex || !encryptedText) return text;

        const iv = Buffer.from(ivHex, "hex");

        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            encryption_key,
            iv
        );

        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (error) {
        // If decryption fails, return the original text (fallback for legacy unencrypted data)
        return text;
    }
}

export function hashPhone(phone) {
    if (!phone) return phone;
    // We use a deterministic HMAC with the same encryption_key
    // This allows us to search and index phone numbers without exposing the plaintext
    return crypto
        .createHmac("sha256", encryption_key)
        .update(phone.toString())
        .digest("hex");
}