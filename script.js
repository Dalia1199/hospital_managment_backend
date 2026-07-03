import mongoose from 'mongoose';
import subscriptionmodel from './src/DB/models/subscriptionmodel.js';
mongoose.connect('mongodb://127.0.0.1:27017/carehub').then(async () => {
    const plans = await subscriptionmodel.find({});
    const premium = plans.find(p => p.name === 'Premium Plan');
    const gold = plans.find(p => p.name === 'Gold Plan');
    if (premium) await subscriptionmodel.updateOne({ _id: premium._id }, { name: 'TEMP Plan' });
    if (gold) await subscriptionmodel.updateOne({ _id: gold._id }, { name: 'Premium Plan' });
    if (premium) await subscriptionmodel.updateOne({ _id: premium._id }, { name: 'Gold Plan' });
    console.log('Swapped Gold and Premium names');
    process.exit(0);
});
