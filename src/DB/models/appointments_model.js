import mongoose from "mongoose";

const appointmentsSchema = new mongoose.Schema({

    patientId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "user",

        required: true

    },

    doctorId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "user",

        required: true

    },

    slotId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "availability",

        required: true

    },

    reason: {

        type: String

    },

    status: {

        type: String,

        enum: [
            "booked",
            "completed",
            "cancelled"
        ],

        default: "booked"

    }

}, {

    timestamps: true

});
const appointmentsmodel = mongoose.models.appointments || mongoose.model("appointments", appointmentsSchema)
export default appointmentsmodel

