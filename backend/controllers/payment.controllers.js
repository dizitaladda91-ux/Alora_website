import crypto from "crypto";
import razorpay from "../config/razorpay.js";
import Order from "../models/order.models.js";
import PaymentAttempt from "../models/paymentAttempt.models.js";
import SimpleProduct from "../models/product.models.js";
import User from "../models/userAuth.models.js";
import WebhookEvent from "../models/webhookEvent.models.js";
import { createAffiliateConversion, validateReferral } from "../services/affiliate.service.js";

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

const normalizeCustomer = (customer = {}) => ({
    name: String(customer.name || "").trim(),
    email: String(customer.email || "").trim().toLowerCase(),
    phone: String(customer.phone || "").trim(),
    address: String(customer.address || "").trim()
});

const isCompleteCustomer = (customer) => (
    customer.name && customer.email && customer.phone && customer.address
);

const isValidCustomer = (customer) => (
    isCompleteCustomer(customer)
    && /^\S+@\S+\.\S+$/.test(customer.email)
    && /^\d{10}$/.test(customer.phone)
);

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

const sendOrderSideEffects = async (savedOrder) => {
    const orderData = buildOrderResponse(savedOrder);
    const itemsList = orderData.cart
        .map((item, index) => `${index + 1}. ${item.name} (${item.size}) x ${item.qty} = INR ${item.price * item.qty}`)
        .join("\n");

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

    const { customer } = savedOrder;
    const customerMessage = `Order confirmed - ALORA PRODUCTS\n\nHi ${customer.name},\nOrder ID: ${orderData.order_id}\nPayment ID: ${orderData.payment_id}\n\nItems:\n${itemsList}\n\nTotal Paid: INR ${savedOrder.totalAmount}\nAddress: ${customer.address}`;
    const adminMessage = `NEW ORDER RECEIVED\n\nCustomer: ${customer.name}\nPhone: ${customer.phone}\nAddress: ${customer.address}\n\nItems:\n${itemsList}\n\nTotal: INR ${savedOrder.totalAmount}\nOrder ID: ${orderData.order_id}`;
    sendMetaWhatsAppMessage(customer.phone, customerMessage);
    if (process.env.ADMIN_PHONE) sendMetaWhatsAppMessage(process.env.ADMIN_PHONE, adminMessage);

    if (savedOrder.referral?.code) {
        try {
            await createAffiliateConversion({
                referralCode: savedOrder.referral.code,
                clickId: savedOrder.referral.clickId,
                orderId: String(savedOrder._id),
                customerEmail: savedOrder.customer.email,
                amount: savedOrder.totalAmount,
                grossAmount: savedOrder.subtotal,
                discountAmount: savedOrder.affiliateDiscount,
                eligibleAmount: savedOrder.totalAmount,
                currency: savedOrder.currency
            });
            await Order.updateOne({ _id: savedOrder._id }, { $set: { "referral.conversionRecordedAt": new Date() } });
        } catch (error) {
            // The payment and order are valid; retained referral data can be retried safely.
            console.error("Affiliate conversion creation failed:", error.message);
        }
    }
};

const restoreStock = (items) => Promise.all(items.map((item) => SimpleProduct.updateOne(
    { _id: item.productId, "variants.volume": item.variant },
    { $inc: { "variants.$.stock": item.quantity } }
)));

// Used by both the signed browser callback and the signed Razorpay webhook.
// The unique Razorpay payment ID makes concurrent delivery idempotent.
const finalizeCapturedPayment = async ({ razorpayOrderId, razorpayPaymentId, customer }) => {
    const existingOrder = await Order.findOne({ razorpayPaymentId });
    if (existingOrder) return { order: existingOrder, created: false };

    const paymentAttempt = await PaymentAttempt.findOne({ razorpayOrderId }).lean();
    if (!paymentAttempt) throw new Error("Checkout session expired or was not found.");

    const savedCustomer = normalizeCustomer(customer || paymentAttempt.customer);
    if (!isValidCustomer(savedCustomer)) throw new Error("Valid customer details are unavailable for this payment.");

    // Razorpay remains the source of truth for the amount actually charged.
    const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
    const totalAmount = Number(razorpayOrder.amount || 0) / 100;
    if (!Number.isFinite(totalAmount) || totalAmount !== paymentAttempt.totalAmount) {
        throw new Error("Paid amount does not match the secure checkout total.");
    }

    await reservePaidOrderStock(paymentAttempt.items);
    let savedOrder;
    try {
        savedOrder = await Order.create({
            razorpayOrderId,
            razorpayPaymentId,
            userId: paymentAttempt.userId || null,
            customer: savedCustomer,
            items: paymentAttempt.items,
            subtotal: paymentAttempt.subtotal,
            affiliateDiscount: paymentAttempt.affiliateDiscount || 0,
            referral: paymentAttempt.referral || {},
            totalAmount,
            currency: razorpayOrder.currency || "INR",
            paymentStatus: "paid",
            orderStatus: "paid"
        });
    } catch (error) {
        await restoreStock(paymentAttempt.items);
        if (error?.code === 11000) {
            const concurrentOrder = await Order.findOne({ razorpayPaymentId });
            if (concurrentOrder) return { order: concurrentOrder, created: false };
        }
        throw error;
    }

    await PaymentAttempt.deleteOne({ _id: paymentAttempt._id });
    await sendOrderSideEffects(savedOrder);
    return { order: savedOrder, created: true };
};

export const createOrder = async (req, res) => {
    try {
        const items = await resolveCatalogItems(req.body.cart);
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const referral = req.body.referral || {};
        const customer = normalizeCustomer(req.body.customer || { email: req.body.customerEmail });
        let customerEmail = customer.email;

        if (!isValidCustomer(customer)) {
            throw new Error("A valid name, email, 10-digit phone number, and delivery address are required.");
        }

        if (!customerEmail && req.user?.id && /^[0-9a-fA-F]{24}$/.test(req.user.id)) {
            const user = await User.findById(req.user.id).select("email").lean();
            customerEmail = user?.email || "";
        }

        let discountPercent = 0;
        let referralCode = null;
        let clickId = null;
        if (referral?.code) {
            if (!customerEmail) throw new Error("Email is required to validate the referral discount.");
            const referralStatus = await validateReferral({ referralCode: String(referral.code), customerEmail });
            if (referralStatus.valid === true && referralStatus.eligible === true) {
                discountPercent = Math.min(100, Math.max(0, Number(referralStatus.discountPercent) || 0));
                referralCode = String(referral.code);
                clickId = referral.clickId ? String(referral.clickId) : null;
            }
        }

        const affiliateDiscount = Number((subtotal * discountPercent / 100).toFixed(2));
        const totalAmount = Number((subtotal - affiliateDiscount).toFixed(2));

        const order = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        await PaymentAttempt.create({
            userId: req.user?.id && /^[0-9a-fA-F]{24}$/.test(req.user.id) ? req.user.id : null,
            razorpayOrderId: order.id,
            customer,
            items,
            subtotal,
            affiliateDiscount,
            referral: { code: referralCode, clickId, discountPercent },
            totalAmount,
            currency: order.currency || "INR"
        });

        return res.status(200).json({ order, razorpay_key_id: process.env.RAZORPAY_KEY_ID, amount: totalAmount, affiliateDiscount, customerEmail });
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

        if (!isValidCustomer(normalizeCustomer(customer))) {
            return res.status(400).json({ status: "failure", message: "Valid customer details are required." });
        }
        const result = await finalizeCapturedPayment({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            customer
        });
        return res.status(200).json({
            status: "success",
            message: result.created ? "Payment verified and order saved." : "Payment was already verified.",
            orderData: buildOrderResponse(result.order)
        });
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

export const handleRazorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!signature || !webhookSecret || !Buffer.isBuffer(req.body)) {
            return res.status(400).json({ success: false, message: "Invalid webhook configuration or payload." });
        }

        const expected = crypto.createHmac("sha256", webhookSecret).update(req.body).digest("hex");
        const expectedBuffer = Buffer.from(expected, "utf8");
        const signatureBuffer = Buffer.from(String(signature), "utf8");
        if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature." });
        }

        const payload = JSON.parse(req.body.toString("utf8"));
        // Razorpay delivers an event-id header. The hash fallback preserves idempotency
        // if a proxy strips that header before it reaches this server.
        const eventId = req.headers["x-razorpay-event-id"]
            || payload?.event_id
            || crypto.createHash("sha256").update(req.body).digest("hex");

        let webhookEvent;
        try {
            webhookEvent = await WebhookEvent.create({
                eventId: String(eventId),
                event: payload.event || "unknown",
                status: "processing"
            });
        } catch (error) {
            if (error?.code !== 11000) throw error;
            webhookEvent = await WebhookEvent.findOne({ eventId: String(eventId) });
            if (webhookEvent?.status === "completed") {
                return res.status(200).json({ success: true, duplicate: true });
            }
            await WebhookEvent.updateOne(
                { _id: webhookEvent._id },
                { $set: { event: payload.event || "unknown", status: "processing", lastError: "" } }
            );
        }

        try {
            const payment = payload?.payload?.payment?.entity;
            if (payment?.id && payment?.order_id && payload.event === "payment.captured") {
                await finalizeCapturedPayment({
                    razorpayOrderId: payment.order_id,
                    razorpayPaymentId: payment.id
                });
            }
            await WebhookEvent.updateOne(
                { eventId: String(eventId) },
                { $set: { status: "completed", processedAt: new Date(), lastError: "" } }
            );
            return res.status(200).json({ success: true });
        } catch (error) {
            await WebhookEvent.updateOne(
                { eventId: String(eventId) },
                { $set: { status: "failed", lastError: String(error.message || "Webhook processing failed.").slice(0, 1000) } }
            );
            throw error;
        }
    } catch (error) {
        console.error("Razorpay webhook error:", error.message);
        return res.status(500).json({ success: false, message: "Webhook processing failed." });
    }
};

export const testConnection = (req, res) => {
    res.json({ message: "Backend connection is working." });
};
