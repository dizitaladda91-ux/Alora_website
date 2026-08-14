import mongoose from "mongoose";
import dns from "node:dns";

let connectionPromise = null;

const configureDns = () => {
    // MongoDB Atlas `mongodb+srv` URLs need an SRV DNS lookup. Apply this in
    // the shared DB module (not only index.js) so CLI scripts use the same
    // resolver configuration as the Express app.
    const configuredServers = String(process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8")
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean);

    if (configuredServers.length > 0) {
        dns.setServers(configuredServers);
    }
};

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;

const db = async () => {
    if (isDatabaseConnected()) {
        return mongoose.connection;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured.");
    }

    configureDns();

    // Serverless requests can arrive together during a cold start. Reuse one
    // connection attempt instead of opening a MongoDB connection per request.
    if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            maxPoolSize: 10
        }).then(() => {
            console.log("MongoDB connected successfully.");
            return mongoose.connection;
        }).catch((error) => {
            connectionPromise = null;
            console.error("MongoDB connection failed:", error.message);
            throw error;
        });
    }

    return connectionPromise;
};

export default db;
