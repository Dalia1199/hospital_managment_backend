import mongoose from "mongoose";

const medicalHistorySchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Types.ObjectId,
            ref: "patient",
            required: true
        },

        doctorId: {
            type: mongoose.Types.ObjectId,
            ref: "doctor",
            required: true
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
        ]
    },
    {
        timestamps: true
    }
);

const medicalhistorymodel =mongoose.models.medicalhistory ||mongoose.model("medicalhistory", medicalHistorySchema);

export default medicalhistorymodel;