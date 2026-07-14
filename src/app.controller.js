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
import clinicrouter from "./modules/clinics/clinic.controller.js";

import airouter from "./modules/ai/ai.routes.js";
import drugsrouter from "./modules/drugs/drugs.routes.js";
import walletRouter from "./modules/wallet/wallet.router.js";
import payoutRouter from "./modules/payout/payout.router.js";
import appConfigRouter from "./modules/appconfig/appconfig.router.js";
import { startMedicationCron } from "./common/cron/medicationCron.js";
import cronRouter from "./common/cron/cron.controller.js";
import paymentRouter from "./modules/payment/payment.controller.js";
import reviewrouter from "./modules/reviews/review.controller.js";
import webauthnrouter from "./modules/webauthn/webauthn.controller.js";
import subscriptionRouter from "./modules/subscription/subscription.controller.js";
import { subscriptionCron } from "./common/cron/subscriptioncron.js";
import doctorSubscriptionRouter from "./modules/doctor.subscription/doctorsubscription.controller.js";
import adminDashboardRouter from "./modules/admindashboard/adminDashboard.controller.js";
import doctorDashboardRouter from "./modules/doctordashboard/doctordashboard.controller.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

import supportrouter from "./modules/support/support.controller.js";
const app = express();
const Port = PORT || 3000;

const bootstrap = () => {
    app.use(cors({
        origin: true,
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    }));

    const limiter=rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 1000,
        requestPropertyName:"rate_limit",
        handler:(req,res,next)=>{
            return res.status(429).json({message:"too many requests please try again later"})
        }
    });
    app.use(limiter)
    app.use((req, res, next) => {
        if (req.body) mongoSanitize.sanitize(req.body);
        if (req.params) mongoSanitize.sanitize(req.params);
        if (req.headers) mongoSanitize.sanitize(req.headers);
        if (req.query) mongoSanitize.sanitize(req.query);
        next();
    });

    app.use(express.json());
   app.use( helmet())
   app.use (hpp())

    // DB connection is now awaited in index.js before starting the server
    connectionredis();
    startMedicationCron();
    subscriptionCron();

    app.get("/", (req, res, next) => {
        res.status(200).json({ message: `welcome to carehub app😊` })
    });

    app.use("/users", userrouter);
    app.use("/questions", questionrouter);
    app.use("/answers", answerrouter);
    app.use("/medical-history", medicalrouter);
    app.use("/prescrption", prescrptionrouter);
    app.use("/admin", adminrouter);
    app.use("/doctor", doctorrouter);
    app.use("/patient", patientrouter);
    app.use("/appointments", appointmensrouter);
    app.use("/notifications", notificationrouter);
    app.use("/ai", airouter);
    app.use("/drugs", drugsrouter);
    app.use("/payments", paymentRouter);
    app.use("/clinics", clinicrouter);
    app.use("/reviews", reviewrouter);
    app.use("/webauthn", webauthnrouter);
    app.use("/doctordashboard",doctorDashboardRouter);



    app.use("/subscriptions", subscriptionRouter);
    app.use("/doctorsubscriptions", doctorSubscriptionRouter);
    app.use("/admindashboard", adminDashboardRouter);
    app.use("/support", supportrouter);
    app.use("/api/cron", cronRouter);
    app.use("/wallet", walletRouter);
    app.use("/payout", payoutRouter);
    app.use("/appconfig", appConfigRouter);

    app.use((req, res, next) => {
        throw new Error(`url ${req.originalUrl} is not found😒😒`, { cause: 404 });
    });

    app.use((err, req, res, next) => {
        res.status(err.cause || 500).json({ message: err.message, stack: err.stack });
    });

    return app;
}

export default bootstrap;
