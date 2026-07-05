import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect("mongodb://carehub601_db_user:Carehub_final_654321@ac-frjnfki-shard-00-00.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-01.0dghj7n.mongodb.net:27017,ac-frjnfki-shard-00-02.0dghj7n.mongodb.net:27017/?ssl=true&replicaSet=atlas-6e7ni4-shard-0&authSource=admin&appName=Cluster0").then(async () => {
    console.log("Connected to MongoDB Atlas.");
    
    await mongoose.connection.collection("wallets").deleteMany({});
    console.log("Cleared all wallets.");
    
    await mongoose.connection.collection("transactions").deleteMany({});
    console.log("Cleared all transactions.");
    
    await mongoose.connection.collection("payoutrequests").deleteMany({});
    console.log("Cleared all payoutrequests.");
    
    await mongoose.connection.collection("payoutchangerequests").deleteMany({});
    console.log("Cleared all payoutchangerequests.");
    
    // Also reset payoutProfile on all users
    await mongoose.connection.collection("users").updateMany(
        {}, 
        { $unset: { payoutProfile: "" } }
    );
    console.log("Reset payout profiles for all users.");

    await mongoose.connection.collection("payments").deleteMany({});
    console.log("Cleared all payments.");

    await mongoose.connection.collection("appointments").updateMany({}, {
        $set: { paymentStatus: 'pending', paidAmount: 0 }
    });
    console.log("Reset appointment payment statuses.");

    await mongoose.connection.collection("appointments").updateMany({ status: 'completed' }, {
        $set: { status: 'booked' }
    });
    console.log("Reset completed appointments back to booked.");
    
    console.log("Clean up finished!");
    process.exit();
}).catch(console.error);
