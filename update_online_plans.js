import mongoose from 'mongoose';
import subscriptionmodel from './src/DB/models/subscriptionmodel.js';
import { DB_URL_ONLINE } from './config/config.service.js';

const run = async () => {
    try {
        await mongoose.connect('mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0');
        console.log('Connected to ONLINE DB');

        // Fix Free Plan limits
        await subscriptionmodel.updateOne(
            { price: 0 },
            {
                $set: {
                    limits: [{ code: 'maxClinics', value: 0 }]
                }
            }
        );

        // Rename 1000 plan to Premium Plan TEMP
        await subscriptionmodel.updateOne(
            { price: 1000 },
            {
                $set: {
                    name: 'Premium Plan TEMP'
                }
            }
        );

        // Rename 500 plan to Gold Plan
        await subscriptionmodel.updateOne(
            { price: 500 },
            {
                $set: {
                    name: 'Gold Plan'
                }
            }
        );

        // Rename 1000 plan to Premium Plan
        await subscriptionmodel.updateOne(
            { price: 1000 },
            {
                $set: {
                    name: 'Premium Plan'
                }
            }
        );

        console.log('Online Plans updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
