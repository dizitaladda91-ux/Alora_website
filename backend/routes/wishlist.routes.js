import express from "express";
import { getWishlist, toggleWishlist } from "../controllers/wishlist.controllers.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAuth, getWishlist);
router.post("/toggle", requireAuth, toggleWishlist);

export default router;
