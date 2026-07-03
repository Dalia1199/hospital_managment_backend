import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function updateFeatures() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;
    
    // Free Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Free Plan' },
        { 
            $set: { 
                features: [
                    { code: 'online_booking', name: 'Online Booking', enabled: true },
                    { code: 'clinic_management', name: 'Records & Prescriptions', enabled: false },
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: false }
                ]
            } 
        }
    );

    // Silver Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Silver Plan' },
        { 
            $set: { 
                features: [
                    { code: 'online_booking', name: 'Online Booking', enabled: true },
                    { code: 'clinic_management', name: 'Records & Prescriptions', enabled: true },
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: false }
                ]
            } 
        }
    );

    // Premium Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Premium Plan' },
        { 
            $set: { 
                features: [
                    { code: 'online_booking', name: 'Online Booking', enabled: true },
                    { code: 'clinic_management', name: 'Records & Prescriptions', enabled: true },
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: true },
                    { code: 'priority_support', name: 'Priority Support', enabled: true }
                ]
            } 
        }
    );

    // Gold Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Gold Plan' },
        { 
            $set: { 
                features: [
                    { code: 'online_booking', name: 'Online Booking', enabled: true },
                    { code: 'clinic_management', name: 'Records & Prescriptions', enabled: true },
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: true },
                    { code: 'priority_support', name: 'Priority Support', enabled: true }
                ]
            } 
        }
    );

    console.log('Features updated successfully.');
    process.exit(0);
}

updateFeatures().catch(console.error);
