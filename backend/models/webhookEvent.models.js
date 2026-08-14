import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  event: { type: String, required: true },
  status: { type: String, enum: ["processing", "completed", "failed"], default: "processing", index: true },
  lastError: { type: String, default: "" },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model("WebhookEvent", webhookEventSchema);
export default WebhookEvent;
