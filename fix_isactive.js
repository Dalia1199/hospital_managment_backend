import mongoose from 'mongoose';
const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';
mongoose.connect(url).then(async () => {
    const db = mongoose.connection.db;
    await db.collection('subscriptionplans').updateMany({}, { $set: { isActive: true } });
    console.log('isActive set to true');
    process.exit(0);
});
