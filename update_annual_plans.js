import mongoose from 'mongoose';

const url = 'mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0';

async function createAnnualPlans() {
    await mongoose.connect(url);
    const db = mongoose.connection.db;

    const basePlans = await db.collection('subscriptionplans').find({ durationInDays: 30, price: { $gt: 0 } }).toArray();

    for (const plan of basePlans) {
        const annualName = plan.name.replace('Plan', 'Annual Plan');
        
        // check if exists
        const existing = await db.collection('subscriptionplans').findOne({ name: annualName });
        if (!existing) {
            await db.collection('subscriptionplans').insertOne({
                name: annualName,
                price: plan.price * 10, // 12 months for the price of 10
                description: plan.description,
                limits: plan.limits,
                features: plan.features,
                durationInDays: 365,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`Created ${annualName}`);
        } else {
            console.log(`${annualName} already exists`);
            // Update to make sure it matches
            await db.collection('subscriptionplans').updateOne(
                { _id: existing._id },
                { $set: { 
                    price: plan.price * 10,
                    limits: plan.limits,
                    features: plan.features,
                    durationInDays: 365,
                    isActive: true
                }}
            );
        }
    }

    console.log('Annual plans initialized.');
    process.exit(0);
}

createAnnualPlans().catch(console.error);
