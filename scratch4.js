import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import exactly as the app does, but mock models locally to avoid heavy startup or path issues
dotenv.config({ path: 'f:/carehub-backend/config/.env.development' });

const subscriptionStatusEnum = {
    pending: "pending",
    active: "active",
    expired: "expired",
    cancelled: "cancelled"
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URI);
        const doctorSubscriptionModel = mongoose.connection.db.collection('doctorsubscriptions');
        
        const result = await doctorSubscriptionModel.aggregate([
            {
                $facet: {
                    byPlan: [
                        { $match: { status: subscriptionStatusEnum.active } },
                        { $lookup: { from: "subscriptionplans", localField: "subscriptionId", foreignField: "_id", as: "plan" } },
                        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
                        { $group: { _id: "$plan.name", count: { $sum: 1 } } }
                    ]
                }
            }
        ]).toArray();
        
        console.log("Aggregation Result:", JSON.stringify(result, null, 2));

        // Let's also just check the raw docs to see what's wrong
        const rawDocs = await doctorSubscriptionModel.find({ status: subscriptionStatusEnum.active }).toArray();
        console.log("Raw active subscriptions count:", rawDocs.length);
        console.log("First raw doc:", rawDocs[0]);
        
        const planId = rawDocs[0]?.subscriptionId;
        console.log("Looking up plan:", planId);
        if (planId) {
            const plan = await mongoose.connection.db.collection('subscriptionplans').findOne({ _id: planId });
            console.log("Found plan:", plan);
        }

        mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
connectDB();
