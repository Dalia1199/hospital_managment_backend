import express from "express";
import { PORT } from "../config/config.service.js";
import checkConnectionDB from "./DB/connectiondb.js";
import userrouter from "./modules/users/user.controller.js";
import { connectionredis } from "./DB/redis/redis.connect.js";
import questionrouter from "./modules/questions/questions.controller.js";
import answerrouter from "./modules/answers/answer.controller.js";
import cors from "cors";
import medicalrouter from "./modules/medicalhistory/medicalhistory.controller.js";
import prescrptionrouter from "./modules/prescrption/prescription.controller.js";
import adminrouter from "./modules/admin/admin.controller.js";
import patientrouter from "./modules/patient/patient.controller.js";

import doctorrouter from "./modules/doctor/doctor.controller.js";
import appointmensrouter from "./modules/appointments/appointmens.controller.js";
import notificationrouter from "./modules/notifications/notification.controller.js";
const app = express();
const Port = PORT || 3000;

const bootstrap = () => {
    app.use(express.json());
    
    // app.use(cors({
    //     origin: "http://localhost:3001",
    //     credentials: true
    // }));
    
    /////update by nermen for allow browser to access the api and allow specific headers and methods
    // We removed the hardcoded http://localhost:3001 origin to allow the dynamic CORS configuration below to work for all frontend URLs including Vercel.



    // app.use(cors({
    //     origin: function (origin, callback) {
    //         callback(null, true);
    //     },
    //     credentials: true
    // }));
    app.use(cors({
        origin: "http://localhost:3001",
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    }));

    checkConnectionDB();
    connectionredis();

    app.get("/", (req, res, next) => {
        res.status(200).json({ message: `welcome to carehub app😊` })
    })

    app.use("/users", userrouter),
        app.use("/questions", questionrouter)
    app.use("/answers", answerrouter);
    app.use("/medical-history", medicalrouter);
    app.use("/prescrption", prescrptionrouter);
    app.use("/admin", adminrouter);
    app.use("/doctor", doctorrouter);
    app.use("/patient", patientrouter);
    app.use("/appointmens", appointmensrouter)
    app.use("/notifications", notificationrouter);

    app.use("{/*demo}", (req, res, next) => {
        throw new Error(`url ${req.originalUrl} is not found😒😒`, { cause: 404 });
    })
    app.use((err, req, res, next) => {
        res.status(err.cause || 500).json({ message: err.message, stack: err.stack })
    })

    return app;
}

export default bootstrap;