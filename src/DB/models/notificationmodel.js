import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Types.ObjectId,
            ref: "user",
            required: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: [
                "appointment", "prescription", "medical_history", "session", 
                "doctor_registration", "license_update", // admin
                "doctor_under_review", "doctor_approved", "doctor_rejected", "license_under_review", "license_approved", "license_rejected", // doctor
                 "patient_booked_appointment", "patient_cancelled_appointment", "patient_completed_appointment" , "patient_rescheduled_appointment", // doctor
            ],
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        link: {
            type: String,
            trim: true
        }
    },
    { timestamps: true }
);

const notificationmodel = mongoose.models.notification || mongoose.model("notification", notificationSchema);
export default notificationmodel;
