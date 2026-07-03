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
                    limits: [{ code: 'maxClinics', value: 0 }]
                }
            }
        );

        // Gold Plan
        await subscriptionmodel.updateOne(
            { price: 500 },
            {
                $set: {
                    limits: [{ code: 'maxClinics', value: 2 }]
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
