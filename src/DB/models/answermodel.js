import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true
    },

    specialization: {
        type: String,
        enum: ["medicine", "dentistry", "physiotherapy"],
        required: true
    },

    answers: [
        {
            questionId: {
                type: mongoose.Types.ObjectId,
                ref: "Question",
                required: true
            },
            answer: {
                type: mongoose.Schema.Types.Mixed,
                required: true
            }
        }
    ]

}, {
    timestamps: true
});

const answemodel = mongoose.models.answer || mongoose.model("answer",answerSchema)
export default answemodel;