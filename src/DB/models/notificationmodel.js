import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Types.ObjectId,
            ref: "user",
            required: true
        },
        clinicId: {
            type: mongoose.Types.ObjectId,
            ref: "clinic",
            required: false
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
                "doctor_registration", "license_update", "doctor_renew_plan" , "doctor_pay_plan", // admin
                "doctor_under_review", "doctor_approved", "doctor_rejected", "license_under_review", // doctor
                "license_approved", "license_rejected", "patient_booked_appointment", "patient_cancelled_appointment", // doctor 
                "patient_completed_appointment" , "patient_rescheduled_appointment", // doctor
                "certificate_added", "certificate_updated", "certificate_deleted",  // doctor
                "medication"
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
