import dotenv from 'dotenv';
dotenv.config({ path: 'config/.env.development' });

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/carehub');
  const url = 'http://localhost:3000';
  
  const user = await mongoose.connection.db.collection('users').findOne({ role: 'patient' });
  if (!user) { console.log('No patient found'); process.exit(0); }
  
  // Create token exactly as backend does
  const payload = { id: user._id, email: user.email };
  const token = jwt.sign(payload, process.env.ACCESS_SECRET_KEY, { expiresIn: '25h', jwtid: uuidv4() });
  
  console.log('Testing /patient/profile ...');
  const resProfile = await fetch(url + '/patient/profile', { headers: { 'Authorization': 'Bearer ' + token } });
  console.log('Profile Status:', resProfile.status);
  console.log(await resProfile.text());

  console.log('Testing /medical-history/' + user._id + ' ...');
  const resHistory = await fetch(url + '/medical-history/' + user._id, { headers: { 'Authorization': 'Bearer ' + token } });
  console.log('History Status:', resHistory.status);
  console.log(await resHistory.text());

  process.exit(0);
})();
