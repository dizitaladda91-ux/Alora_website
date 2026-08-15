import express from 'express';
import { createReview, getReviewsByProduct } from '../controllers/review.controllers.js';

const router = express.Router();

router.route('/')
    .post(createReview);

router.route('/:productId')
    .get(getReviewsByProduct);

export default router;