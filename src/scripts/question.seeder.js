import mongoose from "mongoose";
import questionmodel from "../DB/models/questionmodel.js";
import { medicalHistoryQuestions } from "./medicalquestion.data.js"



 const db_uri ="mongodb://127.0.0.1:27017/carehub"

const seed = async () => {
    try {

        await mongoose.connect(`${db_uri}`);


        await questionmodel.deleteMany({});

        await questionmodel.insertMany(medicalHistoryQuestions);

        console.log("Medical questions seeded successfully");

        process.exit();

    } catch (error) {
        console.log("Seeder error", error);
        process.exit(1);
    }
};

seed();








