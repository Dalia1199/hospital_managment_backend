import mongoose from "mongoose";

const appConfigSchema = new mongoose.Schema({
    // Only one document should exist for global configuration
    isGlobalConfig: {
        type: Boolean,
        default: true,
        unique: true
    },
    // The fixed platform fee taken from every successful online appointment booking
    platformFeeFixed: {
        type: Number,
        default: 20
    },
    // OR it could be a percentage
    platformFeePercentage: {
        type: Number,
        default: 0
    },
    // Dynamic Commission Rates based on Doctor's Plan
    commissionRates: {
        type: Map,
        of: Number,
        default: {
            'free': 10,
            'silver': 8,
            'gold': 5,
            'premium': 2
        }
    },
    // Fee configurations for patient cancellation
    patientCancellationRefundPercentage: {
        type: Number,
        default: 50 // Patient gets 50% back to wallet
    },
    patientCancellationDoctorCompensationPercentage: {
        type: Number,
        default: 30 // Doctor gets 30%
    },
    patientCancellationPlatformFeePercentage: {
        type: Number,
        default: 20 // Platform keeps 20%
    }
}, { timestamps: true });

const appconfigmodel = mongoose.models.AppConfig || mongoose.model('AppConfig', appConfigSchema);
export default appconfigmodel;
