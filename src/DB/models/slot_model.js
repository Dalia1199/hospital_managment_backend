import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "clinic",
      default: null,
    },

    startDateTime: {
      type: Date,
      required: true,
    },

    endDateTime: {
      type: Date,
      required: true,
    },

    isBooked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const slotmodel = mongoose.models.slot || mongoose.model("slot", slotSchema);
export default slotmodel;
