import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { resolve } from 'path';
import transactionmodel from './src/DB/models/transactionmodel.js';
dotenv.config({ path: resolve('config/.env.development') });
async function run() {
  await mongoose.connect(process.env.DB_URL_ONLINE);
  const agg = await transactionmodel.aggregate([
    { $match: { purpose: 'online_booking_revenue', status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalPlatformFee: { $sum: '$metadata.platformFee' } } }
  ]);
  console.log('Platform Fee:', agg);
  process.exit(0);
}
run().catch(console.error);
