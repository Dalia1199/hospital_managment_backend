import mongoose from "mongoose";

const medicationScheduleSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId, // Matches the _id inside the medications array in prescription
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    scheduleType: {
      type: String,
      enum: ["specific_times", "interval"],
      required: true,
    },
    times: {
      type: [String], // e.g. ["08:00", "20:00"]
      default: [],
    },
    intervalData: {
      hours: { type: Number, default: 0 }, // e.g. every 4 hours
      startTime: { type: String, default: "" }, // e.g. "08:00"
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
    strictQuery: true,
  }
);

// A patient can only have one active schedule per medication
medicationScheduleSchema.index({ patientId: 1, medicationId: 1 }, { unique: true });

export default mongoose.models.medicationschedule || mongoose.model("medicationschedule", medicationScheduleSchema);
