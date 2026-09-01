import express from 'express';
import { createLead, getAllLeads } from '../controllers/lead.controllers.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { createRateLimiter } from "../middlewares/security.middleware.js";

const router = express.Router();

router.post('/newlead', createRateLimiter({ max: 5, message: "Too many lead submissions. Please try again in 15 minutes." }), createLead);
router.get('/', requireAuth, authorizeRoles('admin'), getAllLeads)

export default router;
