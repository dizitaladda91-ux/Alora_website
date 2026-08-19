import express from "express";
import { handleChatbotMessage, submitChatbotQuery } from "../controllers/chatbot.controller.js";

const router = express.Router();

router.post("/message", handleChatbotMessage);
router.post("/query", submitChatbotQuery);

export default router;
