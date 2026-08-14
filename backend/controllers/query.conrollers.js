import { Query } from '../models/query.models.js';
import { sanitizePlainText } from "../services/contentSanitizer.service.js";

// 1. User ki query save karne ke liye
export const createQuery = async (req, res) => {
    try {
        const name = sanitizePlainText(req.body.name, 100);
        const email = sanitizePlainText(req.body.email, 254).toLowerCase();
        const message = sanitizePlainText(req.body.message, 2000);
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address." });
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
