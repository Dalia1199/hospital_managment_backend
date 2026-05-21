import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },

    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },

    medicalHistoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "medicalhistory"
    },

    diagnosis: {
        type: String,
        required: true
    },

    medications: [
        {
            medicineName: {
                type: String,
                required: true
            },

            dosage: {
                type: String,
                required: true
            },

            frequency: {
                type: String,
                required: true
            },

            duration: {
                type: String,
                required: true
            },

            instructions: {
                type: String
            }
        }
    ],

    notes: {
        type: String
    },

    status: {
        type: String,
        enum: ["active", "completed", "cancelled"],
        default: "active"
    }

}, { timestamps: true });

const prescrptionmodel = mongoose.models.prescrption || mongoose.model("prescrption",prescriptionSchema);
export default prescrptionmodel;
