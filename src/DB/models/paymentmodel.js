import mongoose from "mongoose";
import { paymentPurposeEnum, paymentStatusEnum } from "../../common/enum/payment.enum.js";

const paymentSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },

    amount: Number,

    paymentStatus: {
        type: String,

        enum: Object.values(

            paymentStatusEnum

        ),

        default:

            paymentStatusEnum.pending

    },

    purpose: {
        type: String,

        enum: Object.values(

            paymentPurposeEnum

        ),

        required: true
    },

    referenceId: mongoose.Types.ObjectId,

    orderId: String,

    transactionId: String,
    paymentMethod: {
        type: String,
        default: "unknown"
    },
    walletDeduction: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});
const paymentmodel = mongoose.models.payment || mongoose.model("payment", paymentSchema)
export default paymentmodel