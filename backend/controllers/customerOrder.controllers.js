import Order from "../models/order.models.js";

export const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(25, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const filter = { userId: req.user.id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({ success: true, data: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load your orders." });
  }
};
