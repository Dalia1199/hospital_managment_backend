import mongoose from "mongoose";

const assistantSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "clinic",
        required: true
    },
    jobTitle: {
        type: String,
        default: "Secretary"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    permissions: {
        canManageAppointments: { type: Boolean, default: false },
        canManagePatientsVitals: { type: Boolean, default: false },
        canManagePatientsFull: { type: Boolean, default: false },
        canManageBilling: { type: Boolean, default: false },
        canManageClinics: { type: Boolean, default: false },
        canManageReports: { type: Boolean, default: false }
    }
}, { timestamps: true });

export const AssistantModel = mongoose.model("Assistant", assistantSchema);
