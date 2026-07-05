import mongoose from 'mongoose';
import availabilitymodel from './src/DB/models/avalibility_model.js';
mongoose.connect('mongodb+srv://omar1:o123456@cluster0.p75ms.mongodb.net/carehub?retryWrites=true&w=majority&appName=Cluster0').then(async () => {
  const availabilities = await availabilitymodel.find({}).lean();
  console.log('Availabilities count:', availabilities.length);
  const days = availabilities.map(a => a.day);
  console.log('Days in DB:', [...new Set(days)]);
  process.exit(0);
});
