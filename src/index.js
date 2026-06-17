import http from "http";
import bootstrap from "./app.controller.js";
import { initSocket } from "./common/socket/socket.service.js";

const app = bootstrap();
const server = http.createServer(app);

initSocket(server);

server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
});