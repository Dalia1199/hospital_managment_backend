import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
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
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 500
        }
    },
    { timestamps: true }
);

// patient can only review a doctor once
reviewSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

const reviewmodel = mongoose.models.review || mongoose.model("review", reviewSchema);
export default reviewmodel;