import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
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
import clinicrouter from "./modules/clinics/clinic.controller.js";

import airouter from "./modules/ai/ai.routes.js";
import drugsrouter from "./modules/drugs/drugs.routes.js";
const app = express();
const Port = PORT || 3000;

const bootstrap = () => {
    app.use(express.json({ limit: "10kb" }));
    app.use(cookieParser());
    
    // Security Middlewares
    app.use(helmet());
    app.use((req, res, next) => {
        if (req.body) req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
        if (req.params) req.params = mongoSanitize.sanitize(req.params, { replaceWith: '_' });
        next();
    });

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per 15 minutes
        message: "Too many requests from this IP, please try again after 15 minutes",
    });
    app.use(limiter);
    
     app.use(cors({
        origin: [ "http://localhost:3001",
        "https://carehub-two.vercel.app",
        "https://carehub-6h22jtqs8-honda4codings-projects.vercel.app"],
        credentials : true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    }));

    // DB connection is now awaited in index.js before starting the server
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
    app.use("/ai", airouter);
    app.use("/drugs", drugsrouter);
    app.use("/clinics", clinicrouter);


    app.use("{/*demo}", (req, res, next) => {
        throw new Error(`url ${req.originalUrl} is not found😒😒`, { cause: 404 });
    })
    app.use((err, req, res, next) => {
        res.status(err.cause || 500).json({ message: err.message, stack: err.stack })
    })

    return app;
}

export default bootstrap;
