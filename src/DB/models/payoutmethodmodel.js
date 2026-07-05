import mongoose from "mongoose";

const payoutMethodSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    methodType: {
        type: String,
        enum: ['instapay', 'vodafone_cash', 'bank_transfer', 'other'],
        required: true
    },
    accountDetails: {
        type: String,
        required: true
    },
    idPhoto: {
        secure_url: String,
        public_id: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminNotes: {
        type: String,
        default: ''
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const payoutmethodmodel = mongoose.models.PayoutMethod || mongoose.model('PayoutMethod', payoutMethodSchema);
export default payoutmethodmodel;
