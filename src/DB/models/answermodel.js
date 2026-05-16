import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Types.ObjectId,
            ref: "patient",
            required: true
        },

        questionId: {
            type: mongoose.Types.ObjectId,
            ref: "question",
            required: true
        },

        answer: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const answermodel =mongoose.models.answer ||mongoose.model("answer", answerSchema);

export default answermodel;