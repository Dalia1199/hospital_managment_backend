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
    height: { type: String, trim: true },
    weight: { type: String, trim: true },
    allergies: { type: [String], default: [] },
    chronic: { type: [String], default: [] },
    surgeries: { 
        type: [{
            operationName: { type: String, required: true },
            surgeonName: { type: String },
            date: { type: String },
            report: { type: String }
        }], 
        default: [] 
    },
    pulse: { type: String, trim: true },
     sharingSetting: {
        type: String,
        enum: ["all", "own_only", "otp"],
        default: "all"
    },
});

export default mongoose.model("patient", patientSchema);