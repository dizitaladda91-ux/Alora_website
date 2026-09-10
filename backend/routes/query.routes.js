import express from 'express';
import { createQuery, getAllQueries } from '../controllers/query.conrollers.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { createRateLimiter } from "../middlewares/security.middleware.js";

const router = express.Router();

router.post('/', createRateLimiter({ max: 5, message: "Too many contact requests. Please try again in 15 minutes." }), createQuery);
router.get('/', requireAuth, authorizeRoles('admin'), getAllQueries); // GET: http://localhost:5000/api/queries

export default router;
