import mongoose from "mongoose";

const payoutChangeRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    newPaymentMethod: {
        type: String,
        enum: ['instapay', 'vodafone_cash', 'bank_transfer', 'other'],
        required: true
    },
    newAccountDetails: {
        type: String,
        required: true
    },
    idPhotoUrl: {
        type: String,
        required: true
    },
    idPhotoPublicId: {
        type: String,
        required: true
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
    reviewedAt: {
        type: Date
    }
}, { timestamps: true });

const payoutchangerequestmodel = mongoose.models.PayoutChangeRequest || mongoose.model('PayoutChangeRequest', payoutChangeRequestSchema);
export default payoutchangerequestmodel;
