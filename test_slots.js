import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.DB_URL).then(async () => {
  const slots = await mongoose.connection.collection('slots').find({}).toArray();
  console.log('Total slots:', slots.length);
  const byDay = {};
  slots.forEach(s => {
    const d = s.startDateTime.toISOString().split('T')[0];
    byDay[d] = (byDay[d] || 0) + 1;
  });
  console.log(byDay);
  process.exit(0);
});
