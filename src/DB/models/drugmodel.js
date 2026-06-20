import mongoose from "mongoose";

const drugSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true // indexed for faster searching
    },
    category: {
        type: String,
        default: "General"
    }
}, { timestamps: true });

const drugmodel = mongoose.models.Drug || mongoose.model("Drug", drugSchema);

export default drugmodel;
