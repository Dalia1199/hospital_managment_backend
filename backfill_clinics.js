import mongoose from "mongoose";
import sessionmodel from "./src/DB/models/sessionmodel.js";
import medicalhistorymodel from "./src/DB/models/medicalhistorymodel.js";
import clinic_model from "./src/DB/models/clinic_model.js";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./config/.env.development') });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URL_ONLINE || process.env.DB_URL);
        console.log("Connected to DB");
    } catch (err) {
        console.error("DB Connection Error", err);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();

    console.log("Fetching clinics...");
    const clinics = await clinic_model.find({}, '_id');
    if (clinics.length === 0) {
        console.log("No clinics found. Cannot backfill.");
        process.exit(0);
    }

    const getRandomClinic = () => clinics[Math.floor(Math.random() * clinics.length)]._id;

    console.log("Updating sessions...");
    const sessions = await sessionmodel.find({ clinicId: { $exists: false } });
    let sessionCount = 0;
    for (const session of sessions) {
        session.clinicId = getRandomClinic();
        await session.save();
        sessionCount++;
    }
    console.log(`Updated ${sessionCount} sessions.`);

    console.log("Updating medical histories...");
    const histories = await medicalhistorymodel.find({ clinicId: { $exists: false } });
    let historyCount = 0;
    for (const history of histories) {
        history.clinicId = getRandomClinic();
        await history.save();
        historyCount++;
    }
    console.log(`Updated ${historyCount} medical histories.`);

    console.log("Done backfilling.");
    process.exit(0);
};

run();
