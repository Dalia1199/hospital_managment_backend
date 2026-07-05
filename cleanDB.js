
import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve("config/.env.development") });

async function cleanDB() {
  await mongoose.connect(process.env.DB_URL_ONLINE);
  console.log("Connected to DB");

  const collections = ["wallets", "transactions", "sessions", "appointments", "payoutrequests"];
  for (const name of collections) {
    try {
      const result = await mongoose.connection.collection(name).deleteMany({});
      console.log(`Deleted ${result.deletedCount} from ${name}`);
    } catch (err) {
      console.log(`Error deleting ${name}:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log("Done");
}
cleanDB();

