import { genderenum } from "../../common/enum/user.enum.js";
import mongoose from "mongoose";


const patientSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
      age: {
            type: Number,
            required: true
        },
        gender: {
            type: String,
            enum: Object.values(genderenum),
            default: genderenum.male
        },
    bloodType:String,
    medicalHistory: String,
 
});

export default mongoose.model("Patient", patientSchema);