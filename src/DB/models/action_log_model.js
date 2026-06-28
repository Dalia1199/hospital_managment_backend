import mongoose from "mongoose";

const actionLogSchema = new mongoose.Schema({
    assistantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Can ref User or Assistant
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
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
