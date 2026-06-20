import mongoose from "mongoose";

const healthtrackingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Types.ObjectId,
      ref: "patient",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    weight: {
      type: Number,
      required: false,
    },
    height: {
      type: Number,
      required: false,
    },
    bloodPressureSystolic: {
      type: Number,
      required: false,
    },
    bloodPressureDiastolic: {
      type: Number,
      required: false,
    },
    bloodSugar: {
      type: Number,
      required: false,
    },
    temperature: {
      type: Number,
      required: false,
    },
    pulse: {
      type: Number,
      required: false,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    strictQuery: true,
  }
);

export default mongoose.models.healthtracking ||
  mongoose.model("healthtracking", healthtrackingSchema);
