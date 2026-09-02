import crypto from "crypto";
import getRazorpay from "../config/razorpay.js";
import Order from "../models/order.models.js";
import PaymentAttempt from "../models/paymentAttempt.models.js";
import SimpleProduct from "../models/product.models.js";
import User from "../models/userAuth.models.js";
import WebhookEvent from "../models/webhookEvent.models.js";
import { createAffiliateConversion, validateReferral } from "../services/affiliate.service.js";
import { AffiliateReferral, AffiliateConversion } from "../models/affiliate.models.js";
import { sendMail, escapeHtml } from "../services/email.service.js";
import { inventoryTrackingEnabled } from "../config/inventory.js";

// Checkout prices must be calculated here, never from browser-rendered totals.
const FREE_SHIPPING_LIMIT = 499;
const STANDARD_DELIVERY_CHARGE = 40;
const FOUNDER_DELIVERY_CHARGE = 5000;
const MAX_STACKED_COUPONS = 4;
const MAX_COUPON_DISCOUNT_PERCENT = 50;

const roundCurrency = (amount) => Number(Number(amount).toFixed(2));

export const calculateCheckoutTotals = ({ subtotal, discountPercent, flatDiscount = 0, founderHandDelivery }) => {
    const percentDiscount = roundCurrency(subtotal * discountPercent / 100);
    const totalDiscount = Math.min(subtotal, roundCurrency(percentDiscount + flatDiscount));
    const deliveryCharge = subtotal >= FREE_SHIPPING_LIMIT ? 0 : STANDARD_DELIVERY_CHARGE;
    const founderDeliveryCharge = founderHandDelivery ? FOUNDER_DELIVERY_CHARGE : 0;
    const totalAmount = roundCurrency(Math.max(0, subtotal - totalDiscount + deliveryCharge + founderDeliveryCharge));

    return { affiliateDiscount: totalDiscount, deliveryCharge, founderDeliveryCharge, totalAmount };
};

export const getRequestedCouponCodes = (body) => {
    const rawCodes = [
        ...(Array.isArray(body.couponCodes) ? body.couponCodes : []),
        body.couponCode,
        body.referral?.code
    ];
    const codes = [...new Set(rawCodes
        .map((code) => String(code || "").trim().toUpperCase())
        .filter(Boolean))];

    if (codes.length > MAX_STACKED_COUPONS) {
        throw new Error(`A maximum of ${MAX_STACKED_COUPONS} coupons can be applied to one order.`);
    }
    if (codes.some((code) => !/^[A-Z0-9_-]{5,64}$/.test(code))) {
        throw new Error("One or more coupon codes are invalid.");
    }
    return codes;
};

export const normalizeCheckoutItems = (cart) => {
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

        const enforceInventory = inventoryTrackingEnabled();
        if (!product || !variant || (enforceInventory && (!product.isAvailable || variant.stock < requested.quantity))) {
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
    if (!inventoryTrackingEnabled()) return;
    const reducedItems = [];

    try {
        for (const item of items) {
            const result = await SimpleProduct.updateOne(
                {
                    _id: item.productId,
                    isAvailable: true,
                    variants: { $elemMatch: { volume: item.variant, stock: { $gte: item.quantity } } }
                },
                {
                    $inc: { "variants.$.stock": -item.quantity }
                }
            );

            if (result.modifiedCount === 0) {
                throw new Error(`Insufficient stock for item variant: ${item.variant}`);
            }

            reducedItems.push(item);
        }
    } catch (error) {
        if (reducedItems.length > 0) {
            await restoreStock(reducedItems);
        }
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

const sendOrderEmails = async ({ orderData, savedOrder, itemsList }) => {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
    const { customer } = savedOrder;
    const safeItems = orderData.cart.map((item) => (
        `<li>${escapeHtml(item.name)} (${escapeHtml(item.size)}) &times; ${item.qty} — INR ${item.price * item.qty}</li>`
    )).join("");

    const emailJobs = [sendMail({
        to: customer.email,
        subject: `Order confirmed — ${orderData.order_id}`,
        text: `Hi ${customer.name},\n\nYour ALORA PRODUCTS order is confirmed.\n\nOrder ID: ${orderData.order_id}\nPayment ID: ${orderData.payment_id}\n\nItems:\n${itemsList}\n\nTotal Paid: INR ${savedOrder.totalAmount}\nDelivery address: ${customer.address}`,
        html: `<div style="font-family:Arial,sans-serif;color:#2a2a24;line-height:1.5"><h2>Order confirmed</h2><p>Hi ${escapeHtml(customer.name)},</p><p>Thank you for shopping with ALORA PRODUCTS. Your order has been confirmed.</p><p><strong>Order ID:</strong> ${escapeHtml(orderData.order_id)}<br><strong>Payment ID:</strong> ${escapeHtml(orderData.payment_id)}</p><h3>Items</h3><ul>${safeItems}</ul><p><strong>Total paid:</strong> INR ${escapeHtml(savedOrder.totalAmount)}<br><strong>Delivery address:</strong><br>${escapeHtml(customer.address).replace(/\n/g, "<br>")}</p></div>`
    })];

    if (adminEmail) {
        emailJobs.push(sendMail({
            to: adminEmail,
            subject: `New order received — ${orderData.order_id}`,
            text: `NEW ORDER RECEIVED\n\nCustomer: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone}\nAddress: ${customer.address}\n\nItems:\n${itemsList}\n\nTotal: INR ${savedOrder.totalAmount}\nOrder ID: ${orderData.order_id}\nPayment ID: ${orderData.payment_id}`,
            html: `<div style="font-family:Arial,sans-serif;color:#2a2a24;line-height:1.5"><h2>New order received</h2><p><strong>Customer:</strong> ${escapeHtml(customer.name)}<br><strong>Email:</strong> ${escapeHtml(customer.email)}<br><strong>Phone:</strong> ${escapeHtml(customer.phone)}<br><strong>Address:</strong><br>${escapeHtml(customer.address).replace(/\n/g, "<br>")}</p><h3>Items</h3><ul>${safeItems}</ul><p><strong>Total:</strong> INR ${escapeHtml(savedOrder.totalAmount)}<br><strong>Order ID:</strong> ${escapeHtml(orderData.order_id)}<br><strong>Payment ID:</strong> ${escapeHtml(orderData.payment_id)}</p></div>`
        }));
    } else {
        console.error("Order email skipped for admin: ADMIN_EMAIL is not configured.");
    }

    const results = await Promise.all(emailJobs);
    console.log("Order confirmation email summary:", {
        orderId: orderData.order_id,
        customerEmailSent: results[0]?.sent === true,
        adminEmailSent: adminEmail ? results[1]?.sent === true : false
    });
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

    await sendOrderEmails({ orderData, savedOrder, itemsList });

    if (savedOrder.referral?.code) {
        try {
            const refCode = String(savedOrder.referral.code).trim().toUpperCase();
            const referralDoc = await AffiliateReferral.findOne({ code: refCode });
            if (referralDoc) {
                const commissionRate = Number(referralDoc.commissionPercent || 10);
                const commissionAmount = Number((savedOrder.totalAmount * commissionRate / 100).toFixed(2));
                
                await AffiliateConversion.create({
                    referralId: referralDoc._id,
                    affiliateId: referralDoc.affiliateId,
                    orderId: String(savedOrder._id),
                    customerEmail: savedOrder.customer.email,
                    clickId: savedOrder.referral.clickId || null,
                    orderAmount: savedOrder.totalAmount,
                    grossAmount: savedOrder.subtotal,
                    discountAmount: savedOrder.affiliateDiscount || 0,
                    commissionAmount,
                    status: "approved"
                }).catch(err => console.warn("Local affiliate conversion notice:", err.message));

                await AffiliateReferral.updateOne(
                    { _id: referralDoc._id },
                    { $inc: { totalConversions: 1, totalCommission: commissionAmount } }
                );
            }

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
            }).catch(err => console.warn("External affiliate API notice:", err.message));

            await Order.updateOne({ _id: savedOrder._id }, { $set: { "referral.conversionRecordedAt": new Date(), "referral.externalSyncedAt": new Date(), "referral.lastSyncError": "" }, $inc: { "referral.syncAttempts": 1 } });
        } catch (error) {
            await Order.updateOne({ _id: savedOrder._id }, { $set: { "referral.lastSyncError": String(error.message || "Affiliate conversion sync failed.").slice(0, 1000) }, $inc: { "referral.syncAttempts": 1 } });
            console.error("Affiliate conversion sync failed:", error.message);
        }
    }
};

const restoreStock = (items) => Promise.all(items.map((item) => SimpleProduct.updateOne(
    { _id: item.productId, "variants.volume": item.variant },
    {
        $inc: { "variants.$.stock": item.quantity },
        $set: { isAvailable: true }
    }
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
    const razorpayOrder = await getRazorpay().orders.fetch(razorpayOrderId);
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
            deliveryCharge: paymentAttempt.deliveryCharge || 0,
            founderDeliveryCharge: paymentAttempt.founderDeliveryCharge || 0,
            appliedCoupons: paymentAttempt.appliedCoupons || [],
            referral: paymentAttempt.referral || {},
            totalAmount,
            inventoryTracked: inventoryTrackingEnabled(),
            currency: razorpayOrder.currency || "INR",
            paymentStatus: "paid",
            orderStatus: "paid"
        });
    } catch (error) {
        if (inventoryTrackingEnabled()) await restoreStock(paymentAttempt.items);
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
        let flatDiscount = 0;
        let referralCode = null;
        let clickId = referral?.clickId ? String(referral.clickId) : null;
        const appliedCoupons = [];
        const candidateCodes = getRequestedCouponCodes(req.body);

        for (const candidateCode of candidateCodes) {
            const isSecretTestCode = candidateCode === "SECRET490" || candidateCode === "ALORA490" || candidateCode === "TEST490" || candidateCode === "FLAT490" || candidateCode === "SPECIAL490";
            // Strict Single-Use Per Account/Email Check
            if (customerEmail && !isSecretTestCode) {
                const usedOrder = await Order.findOne({
                    $or: [
                        { "customer.email": customerEmail },
                        ...(req.user?.id && /^[0-9a-fA-F]{24}$/.test(req.user.id) ? [{ userId: req.user.id }] : [])
                    ],
                    $or: [
                        { appliedCoupons: candidateCode },
                        { "referral.code": candidateCode }
                    ]
                }).lean();

                if (usedOrder) {
                    throw new Error(`Coupon '${candidateCode}' has already been redeemed on your account and can only be used once.`);
                }
            }

            if (isSecretTestCode) {
                flatDiscount += 490;
                appliedCoupons.push(candidateCode);
                continue;
            }

            if (candidateCode === "RAKHI30" || candidateCode === "RAKHI" || candidateCode === "FESTIVE30" || candidateCode === "RAKHI30OFF") {
                discountPercent += 30;
                appliedCoupons.push(candidateCode);
                continue;
            }

            if (candidateCode === "GLOW10") {
                discountPercent += 10;
                appliedCoupons.push(candidateCode);
                continue;
            }

            if (referralCode) continue;

            const referralStatus = await validateReferral({ referralCode: candidateCode, customerEmail });
            const referralMatchesCandidate = String(referral?.code || "").trim().toUpperCase() === candidateCode;
            if (referralStatus.valid === true && referralStatus.eligible === true && referralMatchesCandidate && clickId) {
                discountPercent += Math.max(0, Number(referralStatus.discountPercent) || 0);
                referralCode = candidateCode;
                appliedCoupons.push(candidateCode);
            }
        }

        discountPercent = Math.min(MAX_COUPON_DISCOUNT_PERCENT, discountPercent);

        const founderHandDelivery = req.body.deliveryOption?.founderHandDelivery === true;
        const { affiliateDiscount, deliveryCharge, founderDeliveryCharge, totalAmount } = calculateCheckoutTotals({
            subtotal,
            discountPercent,
            flatDiscount,
            founderHandDelivery
        });

        if (totalAmount <= 0) throw new Error("The payable amount must be greater than zero.");

        const order = await getRazorpay().orders.create({
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
            deliveryCharge,
            founderDeliveryCharge,
            appliedCoupons,
            referral: { code: referralCode, clickId, discountPercent },
            totalAmount,
            currency: order.currency || "INR"
        });

        return res.status(200).json({
            order,
            razorpay_key_id: process.env.RAZORPAY_KEY_ID,
            amount: totalAmount,
            subtotal,
            affiliateDiscount,
            deliveryCharge,
            founderDeliveryCharge,
            appliedCoupons,
            customerEmail
        });
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
