import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log("Connected to MongoDB.");
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));
        
        const subPlans = await mongoose.connection.db.collection('subscriptionplans').find({}).toArray();
        console.log("subscriptionplans data:", subPlans);
        
        const subscriptions = await mongoose.connection.db.collection('doctorsubscriptions').find({}).toArray();
        console.log("doctorsubscriptions data:", subscriptions);
        
        mongoose.disconnect();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
connectDB();
