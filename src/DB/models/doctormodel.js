import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    syncdicatedId:Number,
    licenseimage: {
        secure_url: { type: String, required: false },
        puplic_id: { type: String, required: false },
    },
    specialization: String,
    nationalId:Number,
    experience: Number,
    rating: {
        type: Number,
        default: 0
    }
});

const doctormodel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema)
export default doctormodel