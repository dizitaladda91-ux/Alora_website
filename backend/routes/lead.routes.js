import express from 'express';
import { createLead, getAllLeads } from '../controllers/lead.controllers.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";
import { publicFormLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post('/newlead', publicFormLimiter, createLead);
router.get('/', requireAuth, authorizeRoles('admin'), getAllLeads)

export default router;
