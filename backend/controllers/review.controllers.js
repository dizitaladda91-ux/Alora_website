import Review from '../models/review.models.js';

// @desc    Create a new product review
// @route   POST /api/reviews
export const createReview = async (req, res) => {
    try {
        const { productId, username, rating, comment } = req.body;

        if (!username || !rating || !comment) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const newReview = await Review.create({
            productId: productId || "alora-best-seller",
            username,
            rating,
            comment
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