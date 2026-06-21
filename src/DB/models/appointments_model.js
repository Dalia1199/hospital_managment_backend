import mongoose from "mongoose";

const appointmentsSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "user",

      required: true,
    },

    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    slotId: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "availability",

      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "clinic",
      default: null,
    },

    reason: {
      type: String,
    },

    status: {
      type: String,

      enum: ["booked", "completed", "cancelled"],

      default: "booked",
    },
    appointmentDate: {
      type: Date,
      required: true,
    },

    startDateTime: {
      type: Date,
      required: true,
    },

    endDateTime: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
const appointmentsmodel =
  mongoose.models.appointments ||
  mongoose.model("appointments", appointmentsSchema);
export default appointmentsmodel;
