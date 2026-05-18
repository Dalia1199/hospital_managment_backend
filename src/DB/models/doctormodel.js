import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    syncdicatedId:Number,
    licenseimage: {
        secure_url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        }
    },
    specialization: String,
    nationalId: {
        secure_url: String,
        public_id: String
    },
    experience: Number,
    rating: {
        type: Number,
        default: 0
    }
});

const doctormodel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema)
export default doctormodel