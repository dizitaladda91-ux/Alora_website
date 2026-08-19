import Order from "../models/order.models.js";
import SimpleProduct from "../models/product.models.js";
import getRazorpay from "../config/razorpay.js";

const allowedStatuses = ["paid", "processing", "packed", "shipped", "delivered", "cancelled", "refunded"];

const restoreOrderStock = async (order) => {
  if (order.stockRestoredAt) return;

  await Promise.all(order.items.map((item) => SimpleProduct.updateOne(
    { _id: item.productId, "variants.volume": item.variant },
    [
      {
        $set: {
          variants: {
            $map: {
              input: "$variants",
              as: "v",
              in: {
                $cond: [
                  { $eq: ["$$v.volume", item.variant] },
                  { $mergeObjects: ["$$v", { stock: { $add: ["$$v.stock", item.quantity] } }] },
                  "$$v"
                ]
              }
            }
          },
          isAvailable: true
        }
      }
    ]
  )));
};

export const getAdminOrders = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const filter = {};

    if (status && allowedStatuses.includes(status)) filter.orderStatus = status;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { razorpayOrderId: regex },
        { razorpayPaymentId: regex },
        { "customer.name": regex },
        { "customer.phone": regex }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);

    return res.status(200).json({ success: true, data: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load orders." });
  }
};

export const getAdminOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, data: order });
  } catch {
    return res.status(400).json({ success: false, message: "Invalid order ID." });
  }
};

export const updateAdminOrderStatus = async (req, res) => {
  try {
    const orderStatus = String(req.body.orderStatus || "").trim();
    if (!allowedStatuses.includes(orderStatus) || orderStatus === "refunded") {
      return res.status(400).json({ success: false, message: "Invalid order status." });
    }

    const update = { orderStatus };

    // Tracking fields are optional on every status update, but required in practice
    // once an order moves to "shipped" — enforced here rather than at the schema
    // level so earlier statuses (paid/processing/packed) can still save without them.
    const trackingNumberProvided = Object.prototype.hasOwnProperty.call(req.body, "trackingNumber");
    const courierLinkProvided = Object.prototype.hasOwnProperty.call(req.body, "courierLink");
    const trackingNumber = trackingNumberProvided ? String(req.body.trackingNumber || "").trim().slice(0, 100) : undefined;
    const courierLink = courierLinkProvided ? String(req.body.courierLink || "").trim().slice(0, 500) : undefined;

    if (courierLink && !/^https?:\/\//i.test(courierLink)) {
      return res.status(400).json({ success: false, message: "Courier tracking link must be a valid URL." });
    }
    if (orderStatus === "shipped" && !trackingNumber && trackingNumberProvided === false) {
      return res.status(400).json({ success: false, message: "A tracking number is required to mark an order as shipped." });
    }

    if (trackingNumber !== undefined) update.trackingNumber = trackingNumber;
    if (courierLink !== undefined) update.courierLink = courierLink;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, data: order, message: "Order status updated." });
  } catch {
    return res.status(400).json({ success: false, message: "Could not update order status." });
  }
};

export const updateExpectedDeliveryDate = async (req, res) => {
  try {
    const rawDate = String(req.body.expectedDeliveryDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return res.status(400).json({ success: false, message: "Choose a valid delivery date." });
    }
    const expectedDeliveryDate = new Date(`${rawDate}T12:00:00.000Z`);
    if (Number.isNaN(expectedDeliveryDate.getTime())) {
      return res.status(400).json({ success: false, message: "Choose a valid delivery date." });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { expectedDeliveryDate }, { new: true, runValidators: true }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, data: order, message: "Expected delivery date updated." });
  } catch {
    return res.status(400).json({ success: false, message: "Could not update expected delivery date." });
  }
};

export const refundAdminOrder = async (req, res) => {
  let claimedOrder = null;
  try {
    const reason = String(req.body.reason || "Requested by admin").trim().slice(0, 250);
    claimedOrder = await Order.findOneAndUpdate({
      _id: req.params.id,
      paymentStatus: "paid",
      "refund.razorpayRefundId": null,
      "refund.processing": false
    }, {
      $set: { "refund.processing": true, "refund.reason": reason }
    }, { new: true });

    if (!claimedOrder) {
      return res.status(400).json({ success: false, message: "Order is already refunded, being refunded, or cannot be refunded." });
    }
    if (!claimedOrder.razorpayPaymentId) {
      await Order.updateOne({ _id: claimedOrder._id }, { $set: { "refund.processing": false } });
      return res.status(400).json({ success: false, message: "This order has no payment ID to refund." });
    }

    const refund = await getRazorpay().payments.refund(claimedOrder.razorpayPaymentId, {
      amount: Math.round(claimedOrder.totalAmount * 100),
      notes: { reason, orderId: String(claimedOrder._id) }
    });

    // Persist the completed gateway refund before restoring stock. If restoration ever
    // fails, the order remains refunded and cannot trigger a second Razorpay refund.
    const order = await Order.findByIdAndUpdate(claimedOrder._id, {
      $set: {
        paymentStatus: "refunded",
        orderStatus: "refunded",
        "refund.processing": false,
        "refund.razorpayRefundId": refund.id,
        "refund.amount": Number(refund.amount || 0) / 100,
        "refund.reason": reason,
        "refund.refundedAt": new Date()
      }
    }, { new: true });

    // Mark restoration before the increment so a retried maintenance action cannot add stock twice.
    const restoreTimestamp = new Date();
    const claimedForStockRestore = await Order.findOneAndUpdate(
      { _id: claimedOrder._id, stockRestoredAt: null },
      { $set: { stockRestoredAt: restoreTimestamp } },
      { new: true }
    );

    if (claimedForStockRestore) {
      await restoreOrderStock({ ...claimedOrder.toObject(), stockRestoredAt: null });
    }

    return res.status(200).json({ success: true, data: order.toObject(), message: "Razorpay refund completed and stock restored." });
  } catch (error) {
    if (claimedOrder?._id) {
      await Order.updateOne({ _id: claimedOrder._id, paymentStatus: "paid" }, { $set: { "refund.processing": false } });
    }
    console.error("Refund error:", error);
    return res.status(500).json({ success: false, message: error?.error?.description || error.message || "Refund could not be completed." });
  }
};
