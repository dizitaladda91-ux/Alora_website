import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Order from "../models/order.models.js";
import PaymentAttempt from "../models/paymentAttempt.models.js";
import SimpleProduct from "../models/product.models.js";

const normalizeCheckoutItems = (cart) => {
    if (!Array.isArray(cart)) return [];

    return cart.map((item) => {
        const quantity = Math.max(1, Number(item.qty ?? item.qtyCountOrderMetric ?? 1));
        const rawId = String(item.productId || item.id || item.uniqueCartItemKeyId || "");
        const productId = rawId.includes("__")
            ? rawId.split("__")[0]
            : (rawId.includes("_") ? rawId.split("_")[0] : rawId);

        return {
            productId,
            variant: String(item.size || item.activeSelectedSizeConfig || "Standard").trim(),
            quantity
        };
    }).filter((item) => item.productId && item.quantity > 0 && Number.isInteger(item.quantity));
};

const resolveCatalogItems = async (cart) => {
    const requestedItems = normalizeCheckoutItems(cart);
    if (requestedItems.length === 0) throw new Error("Your cart has no valid product items.");

    const uniqueProductIds = [...new Set(requestedItems.map((item) => item.productId))];
    const products = await SimpleProduct.find({ _id: { $in: uniqueProductIds } }).lean();
    if (products.length !== uniqueProductIds.length) throw new Error("One or more products are no longer available.");

    const productById = new Map(products.map((product) => [String(product._id), product]));
    return requestedItems.map((requested) => {
        const product = productById.get(requested.productId);
        const variant = product?.variants?.find((entry) => entry.volume === requested.variant);

        if (!product || !product.isAvailable || !variant || variant.stock < requested.quantity) {
            throw new Error(`${product?.name || "A product"} or its selected variant is unavailable or out of stock.`);
        }

        const unitPrice = Number(variant.price);
        return {
            productId: String(product._id),
            name: product.name,
            variant: variant.volume,
            quantity: requested.quantity,
            unitPrice,
            lineTotal: unitPrice * requested.quantity,
            image: product.imagepath || ""
        };
    });
};

// Reduces every selected variant only when enough stock remains. If any item fails,
// already-reduced variants are restored so a partial checkout never corrupts stock.
const reservePaidOrderStock = async (items) => {
    const reducedItems = [];

    try {
        for (const item of items) {
            const result = await SimpleProduct.updateOne(
                {
                    _id: item.productId,
                    isAvailable: true,
                    variants: { $elemMatch: { volume: item.variant, stock: { $gte: item.quantity } } }
                },
                { $inc: { "variants.$.stock": -item.quantity } }
            );

            if (result.modifiedCount !== 1) {
                throw new Error(`${item.name} (${item.variant}) is no longer in stock.`);
            }

            reducedItems.push(item);
        }
    } catch (error) {
        await Promise.all(reducedItems.map((item) => SimpleProduct.updateOne(
            { _id: item.productId, "variants.volume": item.variant },
            { $inc: { "variants.$.stock": item.quantity } }
        )));
        throw error;
    }
};

const buildOrderResponse = (order) => ({
    order_id: order.razorpayOrderId,
    payment_id: order.razorpayPaymentId,
    customer: order.customer,
    cart: order.items.map((item) => ({
        name: item.name,
        size: item.variant,
        qty: item.quantity,
        price: item.unitPrice
    })),
    amount: order.totalAmount,
    date: new Date(order.createdAt).toLocaleDateString("en-IN")
});

const sendMetaWhatsAppMessage = async (toPhone, messageText) => {
    try {
        const token = process.env.META_WHATSAPP_TOKEN;
        const phoneId = process.env.META_PHONE_NUMBER_ID;
        if (!token || !phoneId) return;

        let formattedPhone = String(toPhone).replace(/[^0-9]/g, "");
        if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`;

        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedPhone,
                type: "text",
                text: { preview_url: false, body: messageText }
            })
        });

        if (!response.ok) console.error("Meta WhatsApp API request failed.");
    } catch (error) {
        console.error("Meta WhatsApp notification failed:", error.message);
    }
};

export const createOrder = async (req, res) => {
    try {
        const items = await resolveCatalogItems(req.body.cart);
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

        const order = await razorpay.orders.create({
            amount: Math.round(subtotal * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        await PaymentAttempt.create({
            userId: req.user?.id && /^[0-9a-fA-F]{24}$/.test(req.user.id) ? req.user.id : null,
            razorpayOrderId: order.id,
            items,
            subtotal,
            totalAmount: subtotal,
            currency: order.currency || "INR"
        });

        return res.status(200).json({ order, razorpay_key_id: process.env.RAZORPAY_KEY_ID, amount: subtotal });
    } catch (error) {
        console.error("Create Razorpay order error:", error);
        return res.status(400).json({ error: error.message || "Could not validate your cart." });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customer } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(400).json({ status: "failure", message: "Missing payment verification parameters." });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: "failure", message: "Invalid payment signature." });
        }

        const existingOrder = await Order.findOne({ razorpayPaymentId: razorpay_payment_id });
        if (existingOrder) {
            return res.status(200).json({
                status: "success",
                message: "Payment was already verified.",
                orderData: buildOrderResponse(existingOrder)
            });
        }

        if (!customer?.name || !customer?.phone || !customer?.address) {
            return res.status(400).json({ status: "failure", message: "Customer details are required." });
        }

        const paymentAttempt = await PaymentAttempt.findOne({ razorpayOrderId: razorpay_order_id }).lean();
        if (!paymentAttempt) return res.status(400).json({ status: "failure", message: "Checkout session expired or was not found. Please start checkout again." });

        // Razorpay is the source of truth for the amount actually charged.
        const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
        const totalAmount = Number(razorpayOrder.amount || 0) / 100;
        if (!Number.isFinite(totalAmount) || totalAmount !== paymentAttempt.totalAmount) {
            return res.status(400).json({ status: "failure", message: "Paid amount does not match the secure checkout total." });
        }

        // Re-check and atomically decrement inventory after successful payment.
        // The snapshot price is retained, while stock is checked against current inventory.
        await reservePaidOrderStock(paymentAttempt.items);

        let savedOrder;
        try {
            savedOrder = await Order.create({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            userId: paymentAttempt.userId || null,
                customer: { name: customer.name, phone: customer.phone, address: customer.address },
                items: paymentAttempt.items,
                subtotal: paymentAttempt.subtotal,
                totalAmount,
                currency: razorpayOrder.currency || "INR",
                paymentStatus: "paid",
                orderStatus: "paid"
            });
        } catch (error) {
            // Do not lose stock if order persistence fails after payment verification.
            await Promise.all(paymentAttempt.items.map((item) => SimpleProduct.updateOne(
                { _id: item.productId, "variants.volume": item.variant },
                { $inc: { "variants.$.stock": item.quantity } }
            )));
            throw error;
        }

        const orderData = buildOrderResponse(savedOrder);
        const itemsList = orderData.cart
            .map((item, index) => `${index + 1}. ${item.name} (${item.size}) x ${item.qty} = INR ${item.price * item.qty}`)
            .join("\n");

        // External notifications run only after the permanent MongoDB record is created.
        if (process.env.GOOGLE_SHEET_WEBHOOK_URL) {
            fetch(process.env.GOOGLE_SHEET_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_id: orderData.order_id,
                    payment_id: orderData.payment_id,
                    customer: orderData.customer,
                    cart: orderData.cart,
                    amount: orderData.amount
                })
            }).catch((error) => console.error("Google Sheet sync failed:", error.message));
        }

        const customerMessage = `Order confirmed - ALORA PRODUCTS\n\nHi ${customer.name},\nOrder ID: ${orderData.order_id}\nPayment ID: ${orderData.payment_id}\n\nItems:\n${itemsList}\n\nTotal Paid: INR ${totalAmount}\nAddress: ${customer.address}`;
        const adminMessage = `NEW ORDER RECEIVED\n\nCustomer: ${customer.name}\nPhone: ${customer.phone}\nAddress: ${customer.address}\n\nItems:\n${itemsList}\n\nTotal: INR ${totalAmount}\nOrder ID: ${orderData.order_id}`;
        sendMetaWhatsAppMessage(customer.phone, customerMessage);
        if (process.env.ADMIN_PHONE) sendMetaWhatsAppMessage(process.env.ADMIN_PHONE, adminMessage);

        await PaymentAttempt.deleteOne({ _id: paymentAttempt._id });

        return res.status(200).json({ status: "success", message: "Payment verified and order saved.", orderData });
    } catch (error) {
        // A duplicate Razorpay callback can race; return the already-created order when possible.
        if (error?.code === 11000 && req.body?.razorpay_payment_id) {
            const existingOrder = await Order.findOne({ razorpayPaymentId: req.body.razorpay_payment_id });
            if (existingOrder) {
                return res.status(200).json({ status: "success", message: "Payment was already verified.", orderData: buildOrderResponse(existingOrder) });
            }
        }

        console.error("Payment verification error:", error);
        return res.status(500).json({ status: "failure", message: "Payment was verified but the order could not be saved. Contact support with your payment ID." });
    }
};

export const testConnection = (req, res) => {
    res.json({ message: "Backend connection is working." });
};
