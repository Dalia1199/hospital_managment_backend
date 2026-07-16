import { genderenum } from "../../common/enum/user.enum.js";
import mongoose from "mongoose";


import { egyptianGovernorates } from "./clinic_model.js";

const patientSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    dateOfBirth: {
        type: Date,
        required: false // Optional for backward compatibility with old data
    },
    age: {
        type: Number,
        required: false // Making it optional since new patients will use dateOfBirth
    },
    governorate: {
        type: String,
        enum: egyptianGovernorates,
        required: false // Optional for backward compatibility
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
        default: "own_only"
    },
});

// Virtual field to calculate age
patientSchema.virtual('calculatedAge').get(function () {
    if (this.dateOfBirth) {
        const ageDiffMs = Date.now() - new Date(this.dateOfBirth).getTime();
        const ageDate = new Date(ageDiffMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
    return this.age || null;
});

patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

export default mongoose.model("patient", patientSchema);