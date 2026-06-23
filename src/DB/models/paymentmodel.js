import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },

    amount: Number,

    paymentStatus: {
        type: String,
        enum: [
            "pending",
            "paid",
            "failed"
        ],
        default: "pending"
    },

    purpose: {
        type: String,
        enum: [
            "appointment",
            "subscription",
            "other"
        ]
    },

    referenceId: mongoose.Types.ObjectId,

    orderId: String,

    transactionId: String

}, {
    timestamps: true
});
const paymentmodel = mongoose.models.payment || mongoose.model("payment", paymentSchema)
export default paymentmodel