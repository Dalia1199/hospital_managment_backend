import mongoose from "mongoose";

const availabilitySchema = new mongoose.Schema({

    doctorId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "user",

        required: true

    },

    date: {

        type: Date,

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

    isBooked: {

        type: Boolean,

        default: false

    }

}, {

    timestamps: true

});

const availabilitymodel = mongoose.models.availability || mongoose.model("availability", availabilitySchema)
export default availabilitymodel