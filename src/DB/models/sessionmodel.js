import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    doctorId: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true
    },
    patientId: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: function() { return !this.isOfflinePatient; }
    },
    isOfflinePatient: {
        type: Boolean,
        default: false
    },
    guestName: {
        type: String,
        trim: true,
        required: function() { return this.isOfflinePatient; }
    },
    guestPhone: {
        type: String,
        trim: true
    },
    otp: {
        type: String,
        required: function() { return !this.isOfflinePatient; }
    },
    status: {
        type: String,
        enum: ["pending_otp","in_progress", "completed"],
        default: "pending_otp"
    },
    validUntil: {
        type: Date
    }
}, {
    timestamps: true
});

const sessionmodel = mongoose.models.session || mongoose.model("session", sessionSchema);
export default sessionmodel;
