import mongoose from "mongoose";

const payoutRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'paid', 'rejected'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['instapay', 'vodafone_cash', 'bank_transfer', 'other'],
        required: true
    },
    paymentDetails: {
        type: String, // e.g., "Instapay handle: user@instapay" or Vodafone Cash number
        required: true
    },
    adminNotes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

const payoutrequestmodel = mongoose.models.PayoutRequest || mongoose.model('PayoutRequest', payoutRequestSchema);
export default payoutrequestmodel;
