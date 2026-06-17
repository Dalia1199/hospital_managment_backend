import { Server } from "socket.io";

let io;
const onlineUsers = new Map(); // userId -> socketId

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`socket connected: ${socket.id}`);

        // patient registers their userId after connecting
        socket.on("register", (userId) => {
            onlineUsers.set(userId.toString(), socket.id);
            console.log(`user ${userId} registered with socket ${socket.id}`);
        });

        socket.on("disconnect", () => {
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    onlineUsers.delete(userId);
                    console.log(`user ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    return io;
};

export const sendNotificationToUser = (userId, notification) => {
    if (!io) return;
    const socketId = onlineUsers.get(userId.toString());
    if (socketId) {
        io.to(socketId).emit("new_notification", notification);
    }
};