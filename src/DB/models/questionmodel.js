import mongoose from "mongoose";

export const questionSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: String,
        required: true
    },

    type: {
        type: String,
        enum: ["general", "specialized"],
        required: true
    },

    specialization: {
        type: String,
        enum: ["cardiology", "dermatology", "neurology", "general"],
        required: function () {
            return this.type === "specialized";
        },
        default: "general"
    },

    answerType: {
        type: String,
        enum: [
            "text",
            "textarea",
            "number",
            "boolean",
            "single_choice",
            "multi_choice"
        ],
        default: "text"
    },

    options: {
        type: [String],
        required: function () {
            return [
                "single_choice",
                "multi_choice"
            ].includes(this.answerType);
        }
    },

    isRequired: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

const questionmodel =mongoose.models.question || mongoose.model("question", questionSchema);

export default questionmodel;

