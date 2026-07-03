import mongoose from 'mongoose';
import * as db_service from './src/DB/db.service.js';
import usermodel from './src/DB/models/usermodel.js';
import subscriptionmodel from './src/DB/models/subscriptionmodel.js';
import paymentmodel from './src/DB/models/paymentmodel.js';
import { generateCheckoutUrl } from './src/modules/payment/payment.helper.js';

import dotenv from 'dotenv';
dotenv.config({ path: './config/.env.development' });

async function run() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to DB");

    const doctor = await usermodel.findOne({ role: 'doctor' });
    if (!doctor) throw new Error("No doctor found");

    const plan = await subscriptionmodel.findOne();
    if (!plan) throw new Error("No plan found");

    const orderId = Date.now().toString();

    const payment = await paymentmodel.create({
        orderId,
        userId: doctor._id,
        amount: plan.price,
        currency: 'EGP',
        paymentStatus: 'pending',
        purpose: 'subscription',
        referenceId: plan._id
    });

    const paymentUrl = generateCheckoutUrl({
        orderId,
        amount: plan.price,
        metaData: {
            userId: doctor._id.toString(),
            purpose: 'subscription',
            referenceId: plan._id.toString()
        }
    });

    console.log("\n--- TEST URL ---");
    console.log(paymentUrl);
    console.log("----------------\n");

    process.exit(0);
}

run().catch(console.error);
