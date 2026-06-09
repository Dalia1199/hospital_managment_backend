import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
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
// add prescription image 
    prescriptionImage: {
        secure_url: { type: String },
        public_id: { type: String }
    },

    status: {
        type: String,
        enum: ["active", "completed", "cancelled"],
        default: "active"
    }

}, { timestamps: true });

const prescrptionmodel = mongoose.models.prescrption || mongoose.model("prescrption",prescriptionSchema);
export default prescrptionmodel;
