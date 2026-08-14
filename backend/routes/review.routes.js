import express from 'express';
import { createReview, getReviewsByProduct } from '../controllers/review.controllers.js';
import { reviewLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.route('/')
    .post(reviewLimiter, createReview);

router.route('/:productId')
    .get(getReviewsByProduct);

export default router;
