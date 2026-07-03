import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function fixSubscriptions() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;
    
    // get new Free plan
    const freePlan = await db.collection('subscriptionplans').findOne({ name: 'Free Plan' });
    
    if (freePlan) {
        // update all doctorsubscriptions to point to the Free Plan
        const res = await db.collection('doctorsubscriptions').updateMany(
            {},
            { $set: { subscriptionId: freePlan._id } }
        );
        console.log('Moved subscriptions to Free Plan:', res.modifiedCount);
    }
    process.exit(0);
}
fixSubscriptions().catch(console.error);
