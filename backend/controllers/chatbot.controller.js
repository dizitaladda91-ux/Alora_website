import SimpleProduct from "../models/product.models.js";
import Order from "../models/order.models.js";
import { Query } from "../models/query.models.js";

// System prompt for Alora Radiance AI Assistant
const ALORA_SYSTEM_PROMPT = `
You are Alora Assistant, the official AI customer support and shopping advisor for Alora Radiance (aloraradiance.com).
Alora Radiance is a premium skincare brand offering high-performance, dermatologically tested serums, creams, and skin treatments.

Brand Values:
- 100% Safe, Paraben-Free, Cruelty-Free & Dermatologically Tested.
- Fast shipping across India (Free shipping on eligible orders).
- Easy 7-day Return & Refund policy.

Your goals:
1. Help customers find the right skincare products based on their concerns (dry skin, acne, glowing skin, anti-aging, etc.).
2. Be polite, friendly, helpful, concise, and professional.
3. Keep responses nicely formatted in clear bullet points or short paragraphs.
4. Encourage users to explore Alora products and check order tracking if they need order updates.
`;

export const handleChatbotMessage = async (req, res) => {
    try {
        const { message, email, phone } = req.body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message parameter is required."
            });
        }

        const queryText = message.trim();
        const lowerMsg = queryText.toLowerCase();

        // 1. Check for Order Tracking Intent
        const orderMatch = queryText.match(/(?:order|tracking|id|#)?\s*(pay_[A-Za-z0-9]+|order_[A-Za-z0-9]+|[A-Z0-9]{8,24})/i);
        const isOrderQuery = lowerMsg.includes("order") || lowerMsg.includes("track") || lowerMsg.includes("delivery") || lowerMsg.includes("status") || lowerMsg.includes("where is my");

        if (isOrderQuery || orderMatch) {
            let searchFilter = [];
            
            if (orderMatch && orderMatch[1]) {
                const searchId = orderMatch[1].trim();
                searchFilter.push({ razorpayOrderId: searchId });
                searchFilter.push({ razorpayPaymentId: searchId });
                searchFilter.push({ trackingNumber: searchId });
            }
            if (email) searchFilter.push({ "customer.email": email.trim().toLowerCase() });
            if (phone) searchFilter.push({ "customer.phone": phone.trim() });

            if (searchFilter.length > 0) {
                const foundOrder = await Order.findOne({ $or: searchFilter }).sort({ createdAt: -1 });

                if (foundOrder) {
                    const statusFormatted = foundOrder.orderStatus ? foundOrder.orderStatus.toUpperCase() : "PAID";
                    const expectedDate = foundOrder.expectedDeliveryDate 
                        ? new Date(foundOrder.expectedDeliveryDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })
                        : "3-5 Business Days";

                    let orderReply = `📦 **Order Status Found!**\n\n`;
                    orderReply += `• **Order ID**: ${foundOrder.razorpayOrderId}\n`;
                    orderReply += `• **Status**: **${statusFormatted}**\n`;
                    orderReply += `• **Total Amount**: ₹${foundOrder.totalAmount}\n`;
                    orderReply += `• **Expected Delivery**: ${expectedDate}\n`;
                    if (foundOrder.trackingNumber) {
                        orderReply += `• **Tracking No**: ${foundOrder.trackingNumber}\n`;
                    }
                    if (foundOrder.courierLink) {
                        orderReply += `• **Tracking Link**: [Track Package](${foundOrder.courierLink})\n`;
                    }

                    return res.status(200).json({
                        success: true,
                        reply: orderReply,
                        type: "order_status",
                        order: {
                            id: foundOrder.razorpayOrderId,
                            status: foundOrder.orderStatus,
                            totalAmount: foundOrder.totalAmount,
                            expectedDelivery: expectedDate,
                            trackingNumber: foundOrder.trackingNumber,
                            courierLink: foundOrder.courierLink
                        }
                    });
                }
            }

            if (isOrderQuery && (!orderMatch || !orderMatch[1])) {
                return res.status(200).json({
                    success: true,
                    reply: "📦 **Order Tracking Assistant**\n\nTo check your order status, please provide your **Order ID** (e.g. `order_...` or `pay_...`) or the **Email/Phone number** used during checkout.",
                    type: "order_prompt"
                });
            }
        }

        // 2. Fetch Active Products for Knowledge & Recommendation Context
        const activeProducts = await SimpleProduct.find({ isAvailable: true }).limit(10).lean();

        // 3. Product Search / Recommendation Intent
        const isProductQuery = lowerMsg.includes("product") || lowerMsg.includes("serum") || lowerMsg.includes("cream") || 
                               lowerMsg.includes("price") || lowerMsg.includes("buy") || lowerMsg.includes("best") || 
                               lowerMsg.includes("face") || lowerMsg.includes("skin") || lowerMsg.includes("glow") ||
                               lowerMsg.includes("acne") || lowerMsg.includes("routine");

        let matchedProducts = [];
        if (isProductQuery && activeProducts.length > 0) {
            matchedProducts = activeProducts.filter(p => {
                const text = `${p.name} ${p.category} ${p.description} ${p.benefits}`.toLowerCase();
                return lowerMsg.split(" ").some(word => word.length > 3 && text.includes(word));
            });

            if (matchedProducts.length === 0) {
                // Default to bestsellers or top products
                matchedProducts = activeProducts.filter(p => p.isBestseller || p.isFeatured).slice(0, 3);
                if (matchedProducts.length === 0) matchedProducts = activeProducts.slice(0, 3);
            } else {
                matchedProducts = matchedProducts.slice(0, 4);
            }
        }

        // 4. Check if Gemini API key exists for AI Generation
        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
            try {
                const productSummary = activeProducts.map(p => {
                    const price = p.variants?.[0]?.price || 0;
                    return `- ${p.name} (Category: ${p.category}, Price: ₹${price}, Benefits: ${p.benefits || p.description.slice(0, 80)})`;
                }).join("\n");

                const fullPrompt = `${ALORA_SYSTEM_PROMPT}

Live Products Catalog:
${productSummary}

User Question: "${queryText}"

Answer concisely and accurately as Alora AI assistant. If products are relevant, mention their benefits and price.`;

                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }]
                    })
                });

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    const aiReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (aiReply) {
                        return res.status(200).json({
                            success: true,
                            reply: aiReply,
                            type: matchedProducts.length > 0 ? "product_recommendation" : "text",
                            products: matchedProducts.map(p => ({
                                id: p._id,
                                name: p.name,
                                slug: p.slug || p._id,
                                price: p.variants?.[0]?.price || 0,
                                comparePrice: p.variants?.[0]?.comparePrice || 0,
                                imagepath: p.imagepath,
                                category: p.category,
                                rating: p.rating || 4.5
                            }))
                        });
                    }
                }
            } catch (aiErr) {
                console.warn("Gemini Chatbot API error, falling back to rule-based engine:", aiErr.message);
            }
        }

        // 5. Fallback Rule-Based Engine
        let reply = "";
        
        if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey") || lowerMsg.includes("namaste")) {
            reply = "👋 **Hello! Welcome to Alora Radiance.**\n\nHow can I assist you today? You can ask me about:\n• 🛍️ Product recommendations & skincare routines\n• 📦 Tracking your order status\n• 🚚 Delivery & Shipping details\n• 🔄 Returns & Refunds policy";
        } else if (lowerMsg.includes("return") || lowerMsg.includes("refund")) {
            reply = "🔄 **Return & Refund Policy**\n\nWe offer a **7-Day Easy Return/Replacement Policy** for unused products in their original packaging. Refunds are processed within 5-7 business days after quality verification.";
        } else if (lowerMsg.includes("shipping") || lowerMsg.includes("delivery") || lowerMsg.includes("charges")) {
            reply = "🚚 **Shipping Info**\n\n• Standard delivery takes **3-5 business days** across India.\n• We offer **Free Shipping** on eligible orders!\n• Tracking updates will be sent to your email/SMS upon dispatch.";
        } else if (lowerMsg.includes("contact") || lowerMsg.includes("support") || lowerMsg.includes("human") || lowerMsg.includes("email")) {
            reply = "📞 **Customer Support**\n\nYou can reach out to our team at **support@aloraradiance.com** or submit a message right here in the chat!";
        } else if (matchedProducts.length > 0) {
            reply = `✨ **Recommended Alora Radiance Products:**\n\nHere are some of our top skincare essentials tailored for you:`;
        } else {
            reply = "✨ **Thank you for reaching out to Alora Radiance!**\n\nI can help you explore our dermatologically tested skincare products or track your existing order. Feel free to choose from the options below or ask a specific question!";
        }

        return res.status(200).json({
            success: true,
            reply: reply,
            type: matchedProducts.length > 0 ? "product_recommendation" : "text",
            products: matchedProducts.map(p => ({
                id: p._id,
                name: p.name,
                slug: p.slug || p._id,
                price: p.variants?.[0]?.price || 0,
                comparePrice: p.variants?.[0]?.comparePrice || 0,
                imagepath: p.imagepath,
                category: p.category,
                rating: p.rating || 4.5
            }))
        });

    } catch (error) {
        console.error("Chatbot controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process chat message.",
            error: error.message
        });
    }
};

// Leave a Customer Support Query
export const submitChatbotQuery = async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and message are required."
            });
        }

        const newQuery = await Query.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            message: `[Submitted via Chatbot]: ${message.trim()}`,
            status: 'Pending'
        });

        return res.status(201).json({
            success: true,
            message: "Your message has been submitted to Alora Customer Support! We will contact you shortly.",
            queryId: newQuery._id
        });
    } catch (error) {
        console.error("Chatbot submit query error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit support query.",
            error: error.message
        });
    }
};
