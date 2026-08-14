import express from "express";
import { getAffiliateDashboard, registerAffiliate, trackReferralClick, updateAffiliateReferral, updateConversionStatus } from "../controllers/affiliate.controllers.js";
import { authorizeRoles, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerAffiliate);
router.post("/track-click", trackReferralClick);
router.get("/dashboard", requireAuth, authorizeRoles("affiliate"), getAffiliateDashboard);
router.patch("/conversions/:id", requireAuth, authorizeRoles("admin"), updateConversionStatus);
router.patch("/:id", requireAuth, authorizeRoles("admin"), updateAffiliateReferral);

export default router;
