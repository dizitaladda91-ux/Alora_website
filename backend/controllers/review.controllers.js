import Review from '../models/review.models.js';
import { sanitizePlainText } from "../services/contentSanitizer.service.js";

// @desc    Create a new product review
// @route   POST /api/reviews
export const createReview = async (req, res) => {
    try {
        const { productId, username, rating, comment } = req.body;
        const cleanUsername = sanitizePlainText(username, 80);
        const cleanComment = sanitizePlainText(comment, 1000);
        const cleanProductId = sanitizePlainText(productId || "alora-best-seller", 100);
        const numericRating = Number(rating);

        if (!cleanUsername || !cleanComment || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, message: 'Provide a name, review, and whole-star rating from 1 to 5.' });
        }

        const newReview = await Review.create({
            productId: cleanProductId,
            username: cleanUsername,
            rating: numericRating,
            comment: cleanComment
        });

        res.status(201).json({ success: true, data: newReview });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all reviews for a specific product
// @route   GET /api/reviews/:productId
export const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ productId }).sort({ createdAt: -1 }); // Naye reviews pehle dikhenge

        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
