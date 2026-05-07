import mongoose from "mongoose";
import questionmodel from "./src/DB/models/questionmodel.js";
import { db_uri } from "./conflig/conflig.service.js";
import { medicalHistoryQuestions } from "./medicalquestion.data.js"




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








