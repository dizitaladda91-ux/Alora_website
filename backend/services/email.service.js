import nodemailer from "nodemailer";

// A single shared transporter, created lazily and cached, instead of building
// a new one on every email send. Reused by order-confirmation and shipping emails.
let cachedTransporter = null;

const getTransporter = () => {
    const senderEmail = String(process.env.EMAIL_USER || "").trim();
    const senderPassword = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();
    if (!senderEmail || !senderPassword) return null;

    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: senderEmail, pass: senderPassword }
        });
    }
    return cachedTransporter;
};

export const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Generic send used by every email in the app. Never throws — a failed email
// must never undo a successfully saved order or a successful status update.
export const sendMail = async (mailOptions) => {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn("Email skipped: EMAIL_USER or EMAIL_PASS is not configured.");
        return;
    }
    try {
        await transporter.sendMail({
            from: `"ALORA PRODUCTS" <${process.env.EMAIL_USER}>`,
            ...mailOptions
        });
    } catch (error) {
        console.error("Email send failed:", error.message);
    }
};

// Shipping/tracking email, sent once when an order transitions into "shipped".
export const sendShippingEmail = async (order) => {
    const { customer, trackingNumber, courierLink, razorpayOrderId } = order;
    if (!customer?.email) return;

    const trackingLine = trackingNumber
        ? `Tracking Number: ${trackingNumber}`
        : "Your courier partner will share tracking details shortly.";
    const linkHtml = courierLink
        ? `<p><a href="${escapeHtml(courierLink)}" style="color:#4f46e5;font-weight:600;">Track your shipment</a></p>`
        : "";
    const linkText = courierLink ? `Track your shipment: ${courierLink}` : "";

    await sendMail({
        to: customer.email,
        subject: `Your order has shipped — ${razorpayOrderId}`,
        text: `Hi ${customer.name},\n\nGreat news — your ALORA PRODUCTS order is on its way!\n\nOrder ID: ${razorpayOrderId}\n${trackingLine}\n${linkText}\n\nDelivery address: ${customer.address}`,
        html: `
            <div style="font-family:Arial,sans-serif;color:#2a2a24;line-height:1.5">
                <h2>Your order is on its way 🚚</h2>
                <p>Hi ${escapeHtml(customer.name)},</p>
                <p>Great news — your ALORA PRODUCTS order has shipped.</p>
                <p><strong>Order ID:</strong> ${escapeHtml(razorpayOrderId)}<br>
                <strong>${escapeHtml(trackingLine)}</strong></p>
                ${linkHtml}
                <p><strong>Delivery address:</strong><br>${escapeHtml(customer.address).replace(/\n/g, "<br>")}</p>
            </div>
        `
    });
};