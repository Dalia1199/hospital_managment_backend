import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect("mongodb://127.0.0.1:27017/carehub").then(async () => {
    const wallets = await mongoose.connection.collection("wallets").find({}).toArray();
    console.log("Wallets:", wallets);
    
    const txs = await mongoose.connection.collection("transactions").find({ 
        purpose: "online_booking_revenue" 
    }).toArray();
    console.log("Revenues:", txs);
    process.exit();
}).catch(console.error);
