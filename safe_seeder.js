import dotenv from "dotenv";
import { resolve } from "node:path";
import mongoose from "mongoose";

// Load development environment variables
dotenv.config({ path: resolve(`config/.env.development`) });

import usermodel from "./src/DB/models/usermodel.js";
import appointmentsmodel from "./src/DB/models/appointments_model.js";
import paymentmodel from "./src/DB/models/paymentmodel.js";

async function safeSeed() {
    console.log("Connecting to Database...");
    if (!process.env.DB_URL_ONLINE) {
        console.error("DB_URL_ONLINE is not defined in .env.development!");
        process.exit(1);
    }
    
    await mongoose.connect(process.env.DB_URL_ONLINE);
    console.log("Connected to Database. Starting Safe Seeding...");

    try {
        // 1. Fetch one active doctor and one patient to attach the dummy data to
        const doctor = await usermodel.findOne({ role: "doctor" });
        const patient = await usermodel.findOne({ role: "patient" });

        if (!doctor || !patient) {
            console.error("Error: You must have at least 1 Doctor and 1 Patient in the database to run this seeder.");
            process.exit(1);
        }

        console.log(`Using Doctor: ${doctor.fullName} | Patient: ${patient.fullName}`);

        const newAppointments = [];
        const newPayments = [];
        
        const now = new Date();
        
        // Generate 100 historical appointments and payments over the last 6 months (180 days)
        for (let i = 0; i < 100; i++) {
            // Random day between 0 and 180 days ago
            const daysAgo = Math.floor(Math.random() * 180);
            const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            
            // Random time between 9 AM and 5 PM
            const startHours = Math.floor(Math.random() * 8) + 9;
            date.setHours(startHours, 0, 0, 0);
            
            const endDate = new Date(date);
            endDate.setMinutes(30);

            const appointmentId = new mongoose.Types.ObjectId();
            const slotId = new mongoose.Types.ObjectId(); // Fake slot ID is fine for analytics

            const statuses = ["completed", "completed", "completed", "cancelled", "booked"];
            const status = statuses[Math.floor(Math.random() * statuses.length)];

            // Random paid amount between 100 and 500
            const amount = Math.floor(Math.random() * 400) + 100;

            // 2. Prepare Mock Appointment
            newAppointments.push({
                _id: appointmentId,
                patientId: patient._id,
                doctorId: doctor._id,
                slotId: slotId,
                status: status,
                appointmentDate: date,
                startDateTime: date,
                endDateTime: endDate,
                paymentStatus: "paid",
                paidAmount: amount,
                createdAt: date,
                updatedAt: date
            });

            // 3. Prepare Mock Payment for Analytics (Revenue Charts)
            newPayments.push({
                userId: patient._id,
                amount: amount,
                paymentStatus: status === "cancelled" ? "refunded" : "paid",
                purpose: "appointment",
                referenceId: slotId,
                paymentMethod: "card",
                createdAt: date,
                updatedAt: date
            });
        }

        console.log(`Inserting ${newAppointments.length} mock appointments...`);
        await appointmentsmodel.insertMany(newAppointments);
        
        console.log(`Inserting ${newPayments.length} mock payments...`);
        await paymentmodel.insertMany(newPayments);

        console.log("====================================================");
        console.log("✅ SAFE SEEDING COMPLETED SUCCESSFULLY!");
        console.log("⚠️ Notice: NO data was deleted. This script ONLY adds.");
        console.log("====================================================");

    } catch (err) {
        console.error("Seeding Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

safeSeed();
