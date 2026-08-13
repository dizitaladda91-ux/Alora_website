import mongoose from "mongoose";

const paymentAttemptItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  variant: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  image: { type: String, default: "" }
}, { _id: false });

const paymentAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  items: { type: [paymentAttemptItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000), expires: 0 }
}, { timestamps: true });

const PaymentAttempt = mongoose.models.PaymentAttempt || mongoose.model("PaymentAttempt", paymentAttemptSchema);
export default PaymentAttempt;
