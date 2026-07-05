import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Models
import walletmodel from './src/DB/models/walletmodel.js';
import transactionmodel from './src/DB/models/transactionmodel.js';
import withdrawrequestmodel from './src/DB/models/payoutrequestmodel.js';
import paymentmodel from './src/DB/models/paymentmodel.js';
import appointmentsmodel from './src/DB/models/appointments_model.js';
import slotmodel from './src/DB/models/slot_model.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const wipeData = async () => {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.DB_URI);
        console.log("Connected successfully.");

        console.log("Clearing Wallet collection...");
        await walletmodel.deleteMany({});
        
        console.log("Clearing Transaction collection...");
        await transactionmodel.deleteMany({});
        
        console.log("Clearing WithdrawRequest collection...");
        await withdrawrequestmodel.deleteMany({});
        
        console.log("Clearing Payment collection...");
        await paymentmodel.deleteMany({});

        console.log("Wipe completed successfully.");
    } catch (error) {
        console.error("Failed to wipe data:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from database.");
    }
};

wipeData();
