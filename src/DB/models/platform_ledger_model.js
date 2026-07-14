import mongoose from 'mongoose';

const platformLedgerSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    source: {
        type: String,
        enum: ['appointment', 'subscription', 'cancellation'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId, // Could be Payment ID, Appointment ID, etc.
        required: false
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointments',
        required: false
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, { timestamps: true });

const platformledgermodel = mongoose.models.PlatformLedger || mongoose.model('PlatformLedger', platformLedgerSchema);
export default platformledgermodel;
