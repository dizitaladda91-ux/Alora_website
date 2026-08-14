import express from "express";
import { getAffiliateDashboard, registerAffiliate, trackReferralClick, updateAffiliateReferral, updateConversionStatus } from "../controllers/affiliate.controllers.js";
import { authorizeRoles, requireAuth } from "../middlewares/auth.middleware.js";
import { affiliateClickLimiter, affiliateRegistrationLimiter } from "../middlewares/rateLimit.middleware.js";

const router = express.Router();

router.post("/register", affiliateRegistrationLimiter, registerAffiliate);
router.post("/track-click", affiliateClickLimiter, trackReferralClick);
router.get("/dashboard", requireAuth, authorizeRoles("affiliate"), getAffiliateDashboard);
router.patch("/conversions/:id", requireAuth, authorizeRoles("admin"), updateConversionStatus);
router.patch("/:id", requireAuth, authorizeRoles("admin"), updateAffiliateReferral);

export default router;
