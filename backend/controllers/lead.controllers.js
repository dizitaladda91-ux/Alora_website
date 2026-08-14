import Lead from '../models/lead.models.js';

// 1. New Lead Save Karna (Only Name & Email)
export const createLead = async (req, res) => {
    try {
        const { name, email } = req.body;

        // Validation checking
        if (!name || !email) {
            return res.status(400).json({ error: "Name aur Email dono fill karna zaroori hai!" });
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Valid email address enter karein!" });
        }

        const newLead = new Lead({ name, email });
        await newLead.save();

        res.status(201).json({ success: true, message: "Lead successfully saved!" });
    } catch (error) {
        console.error("Lead submission error:", error);
        res.status(500).json({ error: "Server error, please try again later." });
    }
};

// 2. Admin Panel par saari Leads fetch karna
export const getAllLeads = async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });
        res.status(200).json({ 
            success: true, 
            data: leads 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};