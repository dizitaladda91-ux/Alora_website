import Order from "../models/order.models.js";
import User from "../models/userAuth.models.js";

export const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(25, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    
    // Find logged in user to get their registered email and phone number
    const user = await User.findById(req.user.id).select("email phone").lean();
    
    const queryConditions = [{ userId: req.user.id }];
    if (user?.email) {
      queryConditions.push({ "customer.email": user.email.toLowerCase().trim() });
    }
    if (user?.phone) {
      queryConditions.push({ "customer.phone": user.phone.trim() });
    }
    
    const filter = { $or: queryConditions };

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({ success: true, data: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("GET_MY_ORDERS_ERROR:", error);
    return res.status(500).json({ success: false, message: "Could not load your orders." });
  }
};

// Public lookup by Razorpay Order ID or Payment ID only — both are long random
// tokens (not guessable like a phone number), so an exact match on either is
// safe without also requiring a second secret like the customer's phone.
export const trackOrder = async (req, res) => {
  try {
    const identifier = String(req.query.orderId || "").trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: "Enter your Order ID or Payment ID." });
    }

    const order = await Order.findOne({
      $or: [{ razorpayOrderId: identifier }, { razorpayPaymentId: identifier }]
    })
      .select("razorpayOrderId orderStatus paymentStatus trackingNumber courierLink expectedDeliveryDate createdAt items totalAmount customer.name")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "No order found for that Order ID or Payment ID." });
    }

    return res.status(200).json({ success: true, data: order });
  } catch {
    return res.status(500).json({ success: false, message: "Could not look up this order." });
  }
};