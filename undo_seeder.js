import dotenv from "dotenv";
import { resolve } from "node:path";
import mongoose from "mongoose";

// Load development environment variables
dotenv.config({ path: resolve(`config/.env.development`) });

import appointmentsmodel from "./src/DB/models/appointments_model.js";
import paymentmodel from "./src/DB/models/paymentmodel.js";

async function undoSeed() {
    console.log("Connecting to Database...");
    if (!process.env.DB_URL_ONLINE) {
        console.error("DB_URL_ONLINE is not defined!");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.DB_URL_ONLINE);
    console.log("Connected to Database. Removing mock data...");

    try {
        // Find documents created in the last 2 hours (based on their _id timestamp)
        // AND where the explicit 'createdAt' field is older than 24 hours.
        // This uniquely identifies our fake historical data without touching any real tests the user just did!
        
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const objectIdFromTwoHoursAgo = Math.floor(twoHoursAgo.getTime() / 1000).toString(16) + "0000000000000000";
        const minId = new mongoose.Types.ObjectId(objectIdFromTwoHoursAgo);

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Delete mock appointments
        const apptResult = await appointmentsmodel.deleteMany({
            _id: { $gte: minId },
            createdAt: { $lt: twentyFourHoursAgo }
        });
        console.log(`Deleted ${apptResult.deletedCount} mock appointments.`);

        // Delete mock payments
        const paymentResult = await paymentmodel.deleteMany({
            _id: { $gte: minId },
            createdAt: { $lt: twentyFourHoursAgo }
        });
        console.log(`Deleted ${paymentResult.deletedCount} mock payments.`);

        console.log("====================================================");
        console.log("✅ UNDO COMPLETED SUCCESSFULLY!");
        console.log("====================================================");

    } catch (err) {
        console.error("Undo Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

undoSeed();
