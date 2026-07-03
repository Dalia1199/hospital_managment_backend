import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function updatePlans() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;
    
    // Update Free Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Free Plan' },
        { 
            $set: { 
                price: 0,
                limits: [{ code: 'maxClinics', value: 1 }],
                features: [{ code: 'ai', name: 'AI Clinical Assistant', enabled: false }]
            } 
        }
    );

    // Update Silver Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Silver Plan' },
        { 
            $set: { 
                price: 200,
                limits: [{ code: 'maxClinics', value: 1 }],
                features: [{ code: 'ai', name: 'AI Clinical Assistant', enabled: true }]
            } 
        }
    );

    // Update Premium Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Premium Plan' },
        { 
            $set: { 
                price: 500,
                limits: [{ code: 'maxClinics', value: 2 }],
                features: [
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: true },
                    { code: 'priority_support', name: 'Priority Support', enabled: true }
                ]
            } 
        }
    );

    // Update Gold Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Gold Plan' },
        { 
            $set: { 
                price: 1000,
                limits: [{ code: 'maxClinics', value: -1 }], // Unlimited
                features: [
                    { code: 'ai', name: 'AI Clinical Assistant', enabled: true },
                    { code: 'priority_support', name: 'Priority Support', enabled: true }
                ]
            } 
        }
    );

    console.log('Plans updated according to new logic');
    process.exit(0);
}

updatePlans().catch(console.error);
