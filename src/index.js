process.env.TZ = "Africa/Cairo";

import http from "http";
import bootstrap from "./app.controller.js";
import { initSocket } from "./common/socket/socket.service.js";
import checkConnectionDB from "./DB/connectiondb.js";

const app = bootstrap();
const server = http.createServer(app);

initSocket(server);

import "./modules/patient/medication.cron.js";
// Only start the server locally (not on Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    // Await DB connection before accepting requests
    checkConnectionDB().then(() => {
        server.listen(process.env.PORT || 3000, () => {
            console.log(`Server is running on port ${process.env.PORT || 3000}`);
        });
    }).catch((error) => {
        console.error("Failed to start server due to DB connection error:", error);
    });
}

// Export a handler for Vercel Serverless Functions
export default async function (req, res) {
    await checkConnectionDB();
    return app(req, res);
}
