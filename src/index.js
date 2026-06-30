import http from "http";
import bootstrap from "./app.controller.js";
import { initSocket } from "./common/socket/socket.service.js";
import checkConnectionDB from "./DB/connectiondb.js";

const app = bootstrap();
const server = http.createServer(app);

initSocket(server);

// Initialize scheduled cron jobs
import "./modules/appointments/appointment.cron.js";
import "./modules/patient/medication.cron.js";
// Await DB connection before accepting requests
checkConnectionDB().then(() => {
    server.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
}).catch((error) => {
    console.error("Failed to start server due to DB connection error:", error);
});