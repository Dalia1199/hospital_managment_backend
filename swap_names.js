import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function swapNames() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;
    
    // rename Premium Plan to TEMP
    await db.collection('subscriptionplans').updateOne(
        { name: 'Premium Plan' },
        { $set: { name: 'TEMP' } }
    );
    
    // rename Gold Plan to Premium Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'Gold Plan' },
        { $set: { name: 'Premium Plan' } }
    );
    
    // rename TEMP to Gold Plan
    await db.collection('subscriptionplans').updateOne(
        { name: 'TEMP' },
        { $set: { name: 'Gold Plan' } }
    );
    
    console.log('Names swapped successfully.');
    process.exit(0);
}
swapNames().catch(console.error);
