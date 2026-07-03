import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('config/.env.development') });

mongoose.connect(process.env.DB_URL_ONLINE).then(async () => {
  try {
     const slotSchema = new mongoose.Schema({ doctorId: mongoose.Schema.Types.ObjectId, startDateTime: Date, isBooked: Boolean }, { collection: 'slots' });
     const Slot = mongoose.model('slot', slotSchema);

     const doctorId = '6a25851156c2f76e8bf32bff';
     const start = new Date();
     const filter = {
       doctorId,
       isBooked: false,
       startDateTime: { $gte: start },
     };
     
     const slots = await Slot.find(filter).sort({ startDateTime: 1 });
     console.log('Slots fetched exactly like backend:', slots.length);
  } catch(e) {
     console.error(e);
  } finally {
     mongoose.disconnect();
  }
});
