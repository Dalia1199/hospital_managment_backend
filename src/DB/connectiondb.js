import mongoose from "mongoose"
import { db_uri, DB_URL_ONLINE } from "../../config/config.service.js"

// Global cache object to hold the connection across hot reloads and lambda invocations
let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const checkConnectionDB = async () => {
    // 1. If we already have a successful connection, return it immediately (Connection Pooling)
    if (cached.conn) {
        return cached.conn;
    }

    // 2. If a connection is currently being established, wait for it instead of opening a new one
    if (!cached.promise) {
        const opts = {
            serverSelectionTimeoutMS: 5000,
            bufferCommands: false, // Prevent mongoose from buffering if connection is lost
        };

        cached.promise = mongoose.connect(DB_URL_ONLINE, opts)
            .then((mongoose) => {
                console.log(`DB is connected successfuly 😊😊`);
                return mongoose;
            })
            .catch((error) => {
                console.log("fail to connect to DB😒😒", error.message);
                cached.promise = null; // Reset promise on failure so we can try again
                throw error;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default checkConnectionDB;
