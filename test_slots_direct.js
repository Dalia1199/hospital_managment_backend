import mongoose from 'mongoose';
import slotmodel from './src/DB/models/slot_model.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // carehub might use .env.local

async function run() {
  const uri = "mongodb+srv://omar1:o123456@cluster0.p75ms.mongodb.net/carehub?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(uri);
  const slots = await slotmodel.find({}).lean();
  console.log(`Total slots: ${slots.length}`);
  const byDay = {};
  slots.forEach(s => {
    const dStr = s.startDateTime.toISOString().split('T')[0];
    byDay[dStr] = (byDay[dStr] || 0) + 1;
  });
  console.log("Slots by day:", byDay);
  process.exit(0);
}
run();
