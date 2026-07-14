import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    availableBalance: {
        type: Number,
        default: 0
    },
    pendingBalance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const walletmodel = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
export default walletmodel;
