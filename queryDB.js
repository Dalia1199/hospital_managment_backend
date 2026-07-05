
import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve("config/.env.development") });

async function queryDB() {
  await mongoose.connect(process.env.DB_URL_ONLINE);
  
  const clinic = await mongoose.connection.collection("clinics").findOne({ _id: new mongoose.Types.ObjectId("6a3ae2e7ced0f6b003aa4bc7") });
  console.log("Clinic:", JSON.stringify(clinic, null, 2));

  await mongoose.disconnect();
}
queryDB();

