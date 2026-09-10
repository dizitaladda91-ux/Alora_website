import Faq from "../models/faq.models.js";

const DEFAULT_FAQS = [
    {
        question: "Can I use the Alora Radiance Face Wash every day?",
        answer: "Yes! Our Face Wash is dermatologist-formulated to be gentle enough for daily use, morning and night, to remove impurities without stripping skin moisture.",
        order: 1,
        isActive: true
    },
    {
        question: "Can I use the Face Serum every day?",
        answer: "Yes. Apply 3-4 drops daily after cleansing and before your face cream. If you are new to active Retinol, start with alternate nights.",
        order: 2,
        isActive: true
    },
    {
        question: "When should I apply the Face Cream?",
        answer: "Apply the Face Cream right after your serum, morning and night, to lock in active ingredients and seal 24-hour hydration.",
        order: 3,
        isActive: true
    },
    {
        question: "Can I use the Body Lotion every day?",
        answer: "Yes! Apply daily right after a bath/shower when skin is damp for maximum absorption and long-lasting velvety softness.",
        order: 4,
        isActive: true
    },
    {
        question: "How often should I use the Face Scrub?",
        answer: "Use the Face Scrub 2–3 times a week to gently exfoliate dead skin cells, unclog pores, and restore skin smoothness.",
        order: 5,
        isActive: true
    },
    {
        question: "Are Alora Radiance products safe and dermatologically tested?",
        answer: "Yes, all Alora Radiance formulations are 100% dermatologically tested, paraben-free, cruelty-free, and formulated with clean, high-grade ingredients safe for all skin types.",
        order: 6,
        isActive: true
    },
    {
        question: "How can I track my order?",
        answer: "You can easily track your order in real-time by visiting our Track Order page and entering your Order ID and phone number.",
        order: 7,
        isActive: true
    }
];

// 🟢 1. GET ALL ACTIVE FAQS (Public Endpoint)
export const getAllFaqs = async (req, res) => {
    try {
        let faqs = await Faq.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
        
        // Auto-seed if database has no FAQs yet
        if (!faqs || faqs.length === 0) {
            const count = await Faq.countDocuments();
            if (count === 0) {
                await Faq.insertMany(DEFAULT_FAQS);
                faqs = await Faq.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
            }
        }

        return res.status(200).json({
            success: true,
            count: faqs.length,
            data: faqs
        });
    } catch (error) {
        console.error("Error fetching FAQs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load FAQs",
            error: error.message
        });
    }
};

// 🟢 2. GET ALL FAQS FOR ADMIN (Protected Endpoint)
export const getAdminFaqs = async (req, res) => {
    try {
        let faqs = await Faq.find().sort({ order: 1, createdAt: 1 }).lean();
        
        if (!faqs || faqs.length === 0) {
            await Faq.insertMany(DEFAULT_FAQS);
            faqs = await Faq.find().sort({ order: 1, createdAt: 1 }).lean();
        }

        return res.status(200).json({
            success: true,
            count: faqs.length,
            data: faqs
        });
    } catch (error) {
        console.error("Error fetching admin FAQs:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load FAQs for admin",
            error: error.message
        });
    }
};

// 🟢 3. CREATE NEW FAQ (Admin / SEO Admin)
export const createFaq = async (req, res) => {
    try {
        const { question, answer, category, order, isActive } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({ success: false, message: "Question is required." });
        }
        if (!answer || !answer.trim()) {
            return res.status(400).json({ success: false, message: "Answer is required." });
        }

        let nextOrder = order;
        if (nextOrder === undefined || nextOrder === null) {
            const lastFaq = await Faq.findOne().sort({ order: -1 }).lean();
            nextOrder = lastFaq ? (lastFaq.order || 0) + 1 : 1;
        }

        const newFaq = new Faq({
            question: question.trim(),
            answer: answer.trim(),
            category: category ? category.trim() : "General",
            order: Number(nextOrder) || 0,
            isActive: isActive !== undefined ? Boolean(isActive) : true
        });

        await newFaq.save();

        return res.status(201).json({
            success: true,
            message: "FAQ created successfully",
            data: newFaq
        });
    } catch (error) {
        console.error("Error creating FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create FAQ",
            error: error.message
        });
    }
};

// 🟢 4. UPDATE EXISTING FAQ (Admin / SEO Admin)
export const updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, category, order, isActive } = req.body;

        const faq = await Faq.findById(id);
        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found." });
        }

        if (question !== undefined) faq.question = question.trim();
        if (answer !== undefined) faq.answer = answer.trim();
        if (category !== undefined) faq.category = category.trim();
        if (order !== undefined) faq.order = Number(order) || 0;
        if (isActive !== undefined) faq.isActive = Boolean(isActive);

        await faq.save();

        return res.status(200).json({
            success: true,
            message: "FAQ updated successfully",
            data: faq
        });
    } catch (error) {
        console.error("Error updating FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update FAQ",
            error: error.message
        });
    }
};

// 🟢 5. DELETE FAQ (Admin / SEO Admin)
export const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedFaq = await Faq.findByIdAndDelete(id);

        if (!deletedFaq) {
            return res.status(404).json({ success: false, message: "FAQ not found." });
        }

        return res.status(200).json({
            success: true,
            message: "FAQ deleted successfully",
            data: deletedFaq
        });
    } catch (error) {
        console.error("Error deleting FAQ:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete FAQ",
            error: error.message
        });
    }
};
