import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('config/.env.development') });

mongoose.connect(process.env.DB_URL_ONLINE).then(async () => {
  try {
     const slotSchema = new mongoose.Schema({
        doctorId: mongoose.Schema.Types.ObjectId,
        clinicId: mongoose.Schema.Types.ObjectId,
        startDateTime: Date,
        endDateTime: Date,
        isBooked: Boolean
     }, { collection: 'slots' });
     const Slot = mongoose.model('slot', slotSchema);

     const now = new Date();
     const allSlots = await Slot.find({});
     const futureSlots = await Slot.find({ startDateTime: { $gte: now }, isBooked: false });
     
     console.log('Total Slots in DB:', allSlots.length);
     console.log('Future unbooked slots:', futureSlots.length);
     if (futureSlots.length > 0) {
       console.log('Sample future slot:', futureSlots[0]);
     }

  } catch(e) {
     console.error(e);
  } finally {
     mongoose.disconnect();
  }
});
