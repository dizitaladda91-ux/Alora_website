import express from "express";
import {
    getAllFaqs,
    getAdminFaqs,
    createFaq,
    updateFaq,
    deleteFaq
} from "../controllers/faq.controllers.js";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public route to fetch active FAQs for storefront
router.get("/", getAllFaqs);

// Protected routes for Admin & SEO Admin
router.get("/admin", requireAuth, authorizeRoles("admin", "seoadmin"), getAdminFaqs);
router.post("/", requireAuth, authorizeRoles("admin", "seoadmin"), createFaq);
router.put("/:id", requireAuth, authorizeRoles("admin", "seoadmin"), updateFaq);
router.delete("/:id", requireAuth, authorizeRoles("admin", "seoadmin"), deleteFaq);

export default router;
