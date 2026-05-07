
import nodemailer from "nodemailer";
import { Email, password } from "../../../../conflig/conflig.service.js";

export const sendemail = async ({ to, subject, html, attachments = [] }) => {

    const transporter = nodemailer.createTransport({
        service: "gmail",
        tls: {
            rejectUnauthorized: false
        },
        auth: {
            user: Email,
            pass: password
        }
    });

    const info = await transporter.sendMail({
        from: `"Carehub" <${Email}>`,
        to,
        subject: subject || "Hello ✔",
        html: html || "<b>Welcome to Carehub app</b>",
        attachments
    });

    console.log("Message sent:", info.messageId);

    return info.accepted.length > 0;
};
export const generateotp = () => {
    return Math.floor(100000 + Math.random() * 900000);
};