import express from "express";
import { getAdminOrderById, getAdminOrders, refundAdminOrder, updateAdminOrderStatus, updateExpectedDeliveryDate } from "../controllers/order.controllers.js";
import { getMyOrders } from "../controllers/customerOrder.controllers.js";
import { authorizeRoles, requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/my", requireAuth, getMyOrders);
router.use(requireAuth, authorizeRoles("admin"));
router.get("/", getAdminOrders);
router.get("/:id", getAdminOrderById);
router.patch("/:id/status", updateAdminOrderStatus);
router.patch("/:id/expected-delivery", updateExpectedDeliveryDate);
router.post("/:id/refund", refundAdminOrder);

export default router;
