import mongoose from "mongoose";

export const questionSchema = new mongoose.Schema({

    question: {
        type: String,
        required: true,
        trim: true
    },

    type: {
        type: String,
        enum: ["general", "specialized"],
        required: true
    },

    specialization: {
        type: String,
        enum: ["cardiology", "dermatology", "neurology","general"],
        required: function () {
            return this.type === "specialized";
        }
    },

    answerType: {
        type: String,
        enum: ["text", "boolean", "single_choice"],
        default: "text"
    },

    options: {
        type: [String],
        required: function () {
            return this.answerType === "single_choice";
        }
    },

    isRequired: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

const questionmodel = mongoose.models.question || mongoose.model("question", questionSchema)
export default questionmodel;