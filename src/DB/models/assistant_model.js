import mongoose from "mongoose";

const assistantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true
    },
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Clinic",
        required: true
    },
    jobTitle: {
        type: String,
        default: "Secretary"
    },
    permissions: {
        canManageAppointments: { type: Boolean, default: false },
        canManagePatients: { type: Boolean, default: false },
        canManageBilling: { type: Boolean, default: false },
        canManageClinics: { type: Boolean, default: false }
    }
}, { timestamps: true });

export const AssistantModel = mongoose.model("Assistant", assistantSchema);
