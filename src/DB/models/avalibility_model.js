import mongoose from "mongoose";


const availabilitySchema = new mongoose.Schema(
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

    day: {
      type: String,
      enum: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    appointmentDuration: {
      type: Number,
      enum: [15, 20, 30, 45, 60],
      default: 30,
    },
  },
  {
    timestamps: true,
  },
);


availabilitySchema.index(
  { doctorId: 1, clinicId: 1, day: 1 },
  { unique: true }
);

const availabilitymodel =
  mongoose.models.availability || 
  mongoose.model("availability", availabilitySchema);

export default availabilitymodel;
