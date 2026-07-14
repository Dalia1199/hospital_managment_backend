import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'], // credit adds to wallet, debit removes from wallet
        required: true
    },
    purpose: {
        type: String,
        enum: [
            'online_booking_revenue', // Money added to doctor pending balance
            'online_booking_payment', // Patient paid for booking
            'platform_commission',    // Portion kept by platform
            'payout_withdrawal',      // Doctor/Patient requested payout
            'refund',                 // Patient got refunded
            'cancellation_fee',       // Fee deducted upon patient cancellation
            'split_payment_deduction',// Deducted from wallet when splitting with card
            'manual_adjustment',      // Admin manual credit/debit
            'platform_revenue',       // Platform fee collected
            'admin_compensation'      // Compensation issued by support
        ],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId, // Can be Appointment ID or PayoutRequest ID
        required: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Storing specific split amounts (e.g., { platformShare: 50, doctorShare: 250 })
        default: {}
    }
}, { timestamps: true });

const transactionmodel = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
export default transactionmodel;
