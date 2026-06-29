import mongoose from "mongoose";

const actionLogSchema = new mongoose.Schema({
    assistantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user", // Can ref User or Assistant
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "doctor",
        required: true
    },
    action: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

export const ActionLogModel = mongoose.model("ActionLog", actionLogSchema);
