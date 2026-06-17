import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema({

    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
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
            "saturday"
        ],
        required: true
    },

    startTime: {
        type: String,
        required: true
    },

    endTime: {
        type: String,
        required: true
    },

    appointmentDuration: {
        type: Number,
        enum: [15, 20, 30, 45, 60],
        default: 30
    }

}, {
    timestamps: true
});

const availabilitymodel =
    mongoose.models.availability ||
    mongoose.model("availability", availabilitySchema);

export default availabilitymodel;