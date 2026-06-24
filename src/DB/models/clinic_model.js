import mongoose from "mongoose";

const clinicSchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

const clinicmodel = mongoose.models.clinic || mongoose.model("clinic", clinicSchema);
export default clinicmodel;