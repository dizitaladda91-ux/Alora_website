import express from 'express';
import { createQuery, getAllQueries } from '../controllers/query.conrollers.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { publicFormLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post('/', publicFormLimiter, createQuery);       // POST: http://localhost:5000/api/queries
router.get('/', requireAuth, authorizeRoles('admin'), getAllQueries); // GET: http://localhost:5000/api/queries

export default router;
