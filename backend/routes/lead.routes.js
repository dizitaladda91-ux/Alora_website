import express from 'express';
import { createLead, getAllLeads } from '../controllers/lead.controllers.js';
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post('/newlead', createLead);
router.get('/', requireAuth, authorizeRoles('admin'), getAllLeads)

export default router;
