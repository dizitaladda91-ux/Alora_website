import { Query } from '../models/query.models.js';

// 1. User ki query save karne ke liye
export const createQuery = async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const newQuery = new Query({ name, email, message });
        await newQuery.save();

        res.status(201).json({ success: true, message: "Query saved successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Admin ke liye saari queries dekhne ke liye
export const getAllQueries = async (req, res) => {
    try {
        const queries = await Query.find().sort({ createdAt: -1 }); // Latest queries pehle aayengi
        res.status(200).json({ success: true, data: queries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};