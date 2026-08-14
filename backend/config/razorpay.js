import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

let razorpayClient;

// Do not initialise the SDK while the application is loading. A missing
// payment credential must only affect checkout endpoints—not every public API
// route (including the product catalogue) in a serverless function.
const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    }

    if (!razorpayClient) {
        razorpayClient = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }

    return razorpayClient;
};

export default getRazorpay;
