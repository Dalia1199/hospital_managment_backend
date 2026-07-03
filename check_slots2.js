import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('config/.env.development') });

mongoose.connect(process.env.DB_URL_ONLINE).then(async () => {
  try {
     const slotSchema = new mongoose.Schema({ doctorId: mongoose.Schema.Types.ObjectId, startDateTime: Date, isBooked: Boolean }, { collection: 'slots' });
     const Slot = mongoose.model('slot', slotSchema);

     const userSchema = new mongoose.Schema({ fullName: String }, { collection: 'users' });
     const User = mongoose.model('user', userSchema);

     const now = new Date();
     const futureSlots = await Slot.find({ startDateTime: { $gte: now }, isBooked: false });
     
     const doctorSlotCounts = {};
     futureSlots.forEach(s => {
         const dId = s.doctorId.toString();
         doctorSlotCounts[dId] = (doctorSlotCounts[dId] || 0) + 1;
     });

     console.log('--- Doctor Slot Counts ---');
     for (const dId of Object.keys(doctorSlotCounts)) {
         const user = await User.findById(dId);
         console.log(`${user ? user.fullName : 'Unknown'} (${dId}): ${doctorSlotCounts[dId]} slots`);
     }

  } catch(e) {
     console.error(e);
  } finally {
     mongoose.disconnect();
  }
});
