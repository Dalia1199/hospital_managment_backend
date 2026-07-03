import mongoose from 'mongoose';
import subscriptionmodel from './src/DB/models/subscriptionmodel.js';

const run = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/carehub');
        console.log('Connected to DB');

        // Free Plan
        await subscriptionmodel.updateOne(
            { price: 0 },
            {
                $set: {
                    name: 'Free Plan',
                    limits: [{ code: 'maxClinics', value: 0 }],
                    features: [{ code: 'online_booking', name: 'Online Booking', enabled: true }]
                }
            }
        );

        // Silver Plan
        await subscriptionmodel.updateOne(
            { price: 200 },
            {
                $set: {
                    name: 'Silver Plan',
                    limits: [{ code: 'maxClinics', value: 1 }],
                    features: [
                        { code: 'online_booking', name: 'Online Booking', enabled: true },
                        { code: 'staff', name: 'Staff Management', enabled: true }
                    ]
                }
            }
        );

        // Gold Plan
        await subscriptionmodel.updateOne(
            { price: 500 },
            {
                $set: {
                    name: 'Gold Plan',
                    limits: [{ code: 'maxClinics', value: 2 }],
                    features: [
                        { code: 'online_booking', name: 'Online Booking', enabled: true },
                        { code: 'staff', name: 'Staff Management', enabled: true },
                        { code: 'ai', name: 'AI Clinical Assistant', enabled: true }
                    ]
                }
            }
        );

        // Premium Plan
        await subscriptionmodel.updateOne(
            { price: 1000 },
            {
                $set: {
                    name: 'Premium Plan',
                    limits: [{ code: 'maxClinics', value: -1 }],
                    features: [
                        { code: 'online_booking', name: 'Online Booking', enabled: true },
                        { code: 'staff', name: 'Staff Management', enabled: true },
                        { code: 'ai', name: 'AI Clinical Assistant', enabled: true },
                        { code: 'priority_support', name: 'Priority Support', enabled: true }
                    ]
                }
            }
        );

        console.log('Plans updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
