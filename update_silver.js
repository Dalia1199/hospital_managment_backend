import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function updatePlans() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;

    // Update Silver Plan to disable AI
    await db.collection('subscriptionplans').updateOne(
        { name: 'Silver Plan' },
        { 
            $set: { 
                features: [{ code: 'ai', name: 'AI Clinical Assistant', enabled: false }]
            } 
        }
    );

    console.log('Silver plan AI disabled');
    process.exit(0);
}

updatePlans().catch(console.error);
