import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, default: null },
  name: { type: String, required: true, trim: true },
  variant: { type: String, default: "Standard", trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  image: { type: String, default: "" }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, required: true, unique: true, index: true },
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true }
  },
  items: { type: [orderItemSchema], required: true, validate: [items => items.length > 0, "An order needs at least one item."] },
  subtotal: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", uppercase: true, trim: true },
  paymentStatus: { type: String, enum: ["paid", "failed", "refunded"], default: "paid" },
  refund: {
    processing: { type: Boolean, default: false },
    razorpayRefundId: { type: String, default: null },
    amount: { type: Number, default: 0, min: 0 },
    reason: { type: String, default: "", trim: true },
    refundedAt: { type: Date, default: null }
  },
  stockRestoredAt: { type: Date, default: null },
  orderStatus: {
    type: String,
    enum: ["paid", "processing", "packed", "shipped", "delivered", "cancelled", "refunded"],
    default: "paid"
  }
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
