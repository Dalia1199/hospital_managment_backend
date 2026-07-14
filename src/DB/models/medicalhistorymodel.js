import mongoose from "mongoose";

const medicalHistorySchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Types.ObjectId,
            ref: "patient",
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
            type: mongoose.Types.ObjectId,
            ref: "user",
            required: true
        },
        clinicId: {
            type: mongoose.Types.ObjectId,
            ref: "clinic",
            required: false
        },

        sessionId: {
            type: mongoose.Types.ObjectId,
            ref: "session",
            required: false // Optional, populated if vitals are recorded before/during session
        },

        diagnosis: {
            type: String,
            trim: true
        },

        notes: {
            type: String,
            trim: true
        },

        answers: [
            {
                type: mongoose.Types.ObjectId,
                ref: "answer"
            }
        ],

        // Vitals captured during this specific encounter
        height: { type: String, trim: true },
        weight: { type: String, trim: true },
        bloodPressure: { type: String, trim: true },
        sugarLevel: { type: String, trim: true },
        pulse: { type: String, trim: true },
        temperature: { type: String, trim: true },
        ageAtEncounter: { type: Number },
        allergies: { type: [String], default: [] },
        chronic: { type: [String], default: [] },
        surgeries: { 
            type: [{
                operationName: { type: String, required: true },
                surgeonName: { type: String },
                date: { type: String },
                report: { type: String }
            }], 
            default: [] 
        },

        // Quick prescription text if they don't upload image
        prescriptionText: { type: String, trim: true },

        documents: [
            {
                type: {
                    type: String,
                    enum: [
                        "lab",
                        "xray",
                        "mri",
                        "ct",
                        "prescription",
                        "other"
                    ],
                    required: true
                },

                title: {
                    type: String,
                    required: true,
                    trim: true
                },

                secure_url: {
                    type: String,
                    required: true
                },

                public_id: {
                    type: String,
                    required: true
                },

                uploadedBy: {
                    type: mongoose.Types.ObjectId,
                    ref: "user",
                    required: true
                },

                notes: {
                    type: String,
                    trim: true
                },

                uploadedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        attachments: [
            {
                secure_url: String,
                public_id: String
            }
        ],
        // Array to link prescriptions to this medical history record
        prescriptions: [
            {
                type: mongoose.Types.ObjectId,
                ref: "prescrption"
            }
        ],
    },
    {
        timestamps: true
    }
);

const medicalhistorymodel =mongoose.models.medicalhistory ||mongoose.model("medicalhistory", medicalHistorySchema);

export default medicalhistorymodel;