import express from "express";
import { handleChatbotMessage, submitChatbotQuery } from "../controllers/chatbot.controller.js";
import { createRateLimiter } from "../middlewares/security.middleware.js";

const router = express.Router();

router.post("/message", createRateLimiter({ max: 30, message: "Too many chat messages. Please wait a few minutes." }), handleChatbotMessage);
router.post("/query", createRateLimiter({ max: 5, message: "Too many support requests. Please try again in 15 minutes." }), submitChatbotQuery);

export default router;
