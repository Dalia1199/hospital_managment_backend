import mongoose from "mongoose";

const medicationtrackingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "prescrption",
      required: true,
    },
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    scheduledDoseDateTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["taken", "missed"],
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    isAutoSynced: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strictQuery: true,
  }
);

// Prevent duplicate tracking for the same dose
medicationtrackingSchema.index({ patientId: 1, medicationId: 1, scheduledDoseDateTime: 1 }, { unique: true });

export default mongoose.models.medicationtracking ||
  mongoose.model("medicationtracking", medicationtrackingSchema);
