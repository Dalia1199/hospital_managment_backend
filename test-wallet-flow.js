import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config({ path: "./config/.env.development" });

import usermodel from "./src/DB/models/usermodel.js";
import doctormodel from "./src/DB/models/doctormodel.js";
import appointmentsmodel from "./src/DB/models/appointments_model.js";
import walletmodel from "./src/DB/models/walletmodel.js";
import paymentmodel from "./src/DB/models/paymentmodel.js";

import { getWallet } from "./src/modules/wallet/wallet.service.js";
import { calculateCommission, calculateRefundSplit } from "./src/modules/appconfig/appconfig.service.js";
import { addPendingBalance, releasePendingToAvailable, addAvailableBalance, deductAvailableBalance } from "./src/modules/wallet/wallet.service.js";
import payoutrequestmodel from "./src/DB/models/payoutrequestmodel.js";

async function runTest() {
    try {
        console.log("Connecting to DB...");
        await mongoose.connect(process.env.DB_URL);
        console.log("Connected!");

        // 1. Get random doctor and patient
        const doctor = await doctormodel.findOne();
        if (!doctor) throw new Error("No doctor found");
        const patient = await usermodel.findOne({ role: 'patient' });
        if (!patient) throw new Error("No patient found");

        console.log(`Testing with Doctor: ${doctor.userId} and Patient: ${patient._id}`);

        // Get initial wallets
        let docWallet = await getWallet(doctor.userId);
        let patWallet = await getWallet(patient._id);
        console.log(`Initial Doctor Wallet -> Pending: ${docWallet.pendingBalance}, Available: ${docWallet.availableBalance}`);
        console.log(`Initial Patient Wallet -> Available: ${patWallet.availableBalance}`);

        // 2. Simulate Payment Webhook (Booking Paid)
        const appointmentAmount = 500;
        const mockApptId = new mongoose.Types.ObjectId();
        
        console.log("--- 1. Testing Appointment Payment & Commission ---");
        const { doctorShare, platformFee } = await calculateCommission(appointmentAmount);
        console.log(`Amount: ${appointmentAmount}, Platform Fee: ${platformFee}, Doctor Share: ${doctorShare}`);
        
        await addPendingBalance(doctor.userId, doctorShare, mockApptId, { paymentMethod: 'test' });
        docWallet = await getWallet(doctor.userId);
        console.log(`After Payment, Doctor Pending Balance: ${docWallet.pendingBalance}`);

        console.log("--- 2. Testing End Session (Release Funds) ---");
        await releasePendingToAvailable(doctor.userId, mockApptId);
        docWallet = await getWallet(doctor.userId);
        console.log(`After Complete, Doctor Wallet -> Pending: ${docWallet.pendingBalance}, Available: ${docWallet.availableBalance}`);

        console.log("--- 3. Testing Payout Request ---");
        const payoutAmount = Math.min(docWallet.availableBalance, 100);
        if (payoutAmount > 0) {
            await deductAvailableBalance(doctor.userId, payoutAmount, 'payout_withdrawal');
            const req = await payoutrequestmodel.create({
                userId: doctor.userId,
                amount: payoutAmount,
                paymentMethod: 'instapay',
                paymentDetails: 'test@instapay',
                status: 'pending'
            });
            docWallet = await getWallet(doctor.userId);
            console.log(`Requested payout of ${payoutAmount}. New Doctor Available Balance: ${docWallet.availableBalance}`);
            
            // Admin accepts
            req.status = 'paid';
            await req.save();
            console.log("Admin accepted payout request.");
        }

        console.log("--- 4. Testing Cancellation & Refund ---");
        const cancelAmount = 500;
        const mockCancelApptId = new mongoose.Types.ObjectId();
        // Assume patient paid 500 and doctor got pending
        const { doctorShare: dShare } = await calculateCommission(cancelAmount);
        await addPendingBalance(doctor.userId, dShare, mockCancelApptId, { paymentMethod: 'test' });
        docWallet = await getWallet(doctor.userId);
        console.log(`New Booking: Doctor Pending Balance: ${docWallet.pendingBalance}`);

        // Now Cancel
        const { patientRefund, doctorCompensation } = await calculateRefundSplit(cancelAmount);
        console.log(`Cancellation: Patient gets ${patientRefund}, Doctor compensation ${doctorCompensation}`);
        
        // Remove pending
        const { removePendingBalance } = await import('./src/modules/wallet/wallet.service.js');
        await removePendingBalance(doctor.userId, dShare);
        
        // Add refund to patient
        await addAvailableBalance(patient._id, patientRefund, 'refund', mockCancelApptId);
        
        // Add compensation to doctor
        if (doctorCompensation > 0) {
            await addAvailableBalance(doctor.userId, doctorCompensation, 'cancellation_fee', mockCancelApptId);
        }

        docWallet = await getWallet(doctor.userId);
        patWallet = await getWallet(patient._id);

        console.log(`Final Doctor Wallet -> Pending: ${docWallet.pendingBalance}, Available: ${docWallet.availableBalance}`);
        console.log(`Final Patient Wallet -> Available: ${patWallet.availableBalance}`);

        console.log("TEST SUCCESSFUL!");
        process.exit(0);

    } catch (error) {
        console.error("Test Failed:", error);
        process.exit(1);
    }
}

runTest();
