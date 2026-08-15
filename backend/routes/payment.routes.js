import express from "express";
import { createOrder, handleRazorpayWebhook, verifyPayment, testConnection } from "../controllers/payment.controllers.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 1. Razorpay Order Creation Route
router.post("/create-order", optionalAuth, createOrder);

// 2. Razorpay Signature Verification & WhatsApp Notification Route
router.post("/verify-payment", verifyPayment);
router.post("/webhook", handleRazorpayWebhook);

// 3. Server Health Check / Connection Test Route
router.get("/test-connect", testConnection);

export default router;
