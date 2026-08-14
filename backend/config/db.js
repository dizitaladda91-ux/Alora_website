import mongoose from "mongoose";

let connectionPromise = null;

export const isDatabaseConnected = () => mongoose.connection.readyState === 1;

const db = async () => {
    if (isDatabaseConnected()) {
        return mongoose.connection;
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured.");
    }

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
