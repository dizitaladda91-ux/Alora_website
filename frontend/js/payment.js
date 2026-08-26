import BASE_URL from './config.js';
import "./toast.js";
function getSafeCart() {
    try {
        const primary = localStorage.getItem("glowCart");
        if (primary) return JSON.parse(primary);
        const legacy = localStorage.getItem("glowRitualCartData");
        if (legacy) return JSON.parse(legacy);
        return [];
    } catch (e) {
        console.error("Cart reading error:", e);
        return [];
    }
}
function clearAllCart() {
    localStorage.removeItem("glowCart");
    localStorage.removeItem("glowRitualCartData");
    if (typeof window.updateHeaderCartCount === "function") {
        window.updateHeaderCartCount();
    }
}
const button = document.getElementById("payNow");
let signedInCustomer = false;
let savedCustomer = null;
async function registerAndAuthenticate({ name, email, phone, address, password }) {
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, phone, address, source: "checkout", password })
    });
    const registerData = await registerResponse.json();
    if (!registerResponse.ok) {
        throw new Error(registerData.message || "Account could not be created.");
    }
    signedInCustomer = true;
    return registerData.user;
}
function fillSignedInCustomer(user) {
    document.getElementById("custName").value = user.name || "";
    document.getElementById("custEmail").value = user.email || "";
    document.getElementById("custPhone").value = user.phone || "";
    document.getElementById("custAddress").value = user.address || "";
    savedCustomer = user;
    const hasSavedAddress = Boolean(String(user.address || "").trim());
    document.getElementById("checkout-name-field")?.classList.add("hidden");
    document.getElementById("checkout-phone-field")?.classList.add("hidden");
    document.getElementById("checkout-email-field")?.classList.add("hidden");
    document.getElementById("checkout-address-field")?.classList.toggle("hidden", hasSavedAddress);
    document.getElementById("custAddress")?.toggleAttribute("readonly", hasSavedAddress);
    document.getElementById("saved-customer-phone").textContent = user.phone || "—";
    document.getElementById("saved-customer-email").textContent = user.email || "—";
    document.getElementById("saved-customer-address").textContent = user.address || "Add your delivery address below.";
    document.getElementById("saved-customer-address-row")?.classList.toggle("hidden", !hasSavedAddress);
    document.getElementById("saved-customer-summary")?.classList.remove("hidden");
    document.getElementById("checkout-details-title").innerHTML = '<i class="fa-solid fa-truck text-clay"></i> Delivery Details';
    document.getElementById("checkout-account-fields")?.classList.add("hidden");
    const signedInNote = document.getElementById("checkout-signed-in-note");
    signedInNote?.classList.remove("hidden");
    if (signedInNote) signedInNote.textContent = hasSavedAddress
        ? "You are signed in. Your saved mobile number, email and delivery address are shown below."
        : "You are signed in. Add your delivery address once to save it to your account.";
    signedInCustomer = true;
}
async function saveMissingDeliveryAddress(address) {
    if (!signedInCustomer || String(savedCustomer?.address || "").trim()) return;
    const response = await fetch(`${BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not save the delivery address.");
    savedCustomer = data.user;
}
async function restoreSignedInCustomer() {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/session`, { credentials: "include" });
        if (!response.ok) return;
        const { user } = await response.json();
        if (!user || user.role !== "user") return;
        fillSignedInCustomer(user);
    } catch (error) {
        console.warn("Could not restore checkout account.", error);
    }
}
restoreSignedInCustomer();
button?.addEventListener("click", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("custName");
    const phoneInput = document.getElementById("custPhone");
    const emailInput = document.getElementById("custEmail");
    const addressInput = document.getElementById("custAddress");
    const passwordInput = document.getElementById("custPassword");
    const confirmPasswordInput = document.getElementById("custConfirmPassword");
    const name = nameInput?.value.trim();
    const phone = phoneInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    const address = addressInput?.value.trim();
    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";
    if (!name || !phone || !email || !address) {
        window.showToast("Please fill in your delivery details (name, phone, email and address) first.", "warning");
        if (!name && nameInput) nameInput.focus();
        else if (!phone && phoneInput) phoneInput.focus();
        else if (!email && emailInput) emailInput.focus();
        else if (!address && addressInput) addressInput.focus();
        return;
    }
    if (phone.length !== 10 || isNaN(phone)) {
        window.showToast("Please enter a valid 10-digit mobile number.", "warning");
        phoneInput.focus();
        return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        window.showToast("Please enter a valid email address.", "warning");
        emailInput.focus();
        return;
    }
    if (!signedInCustomer && password.length < 6) {
        window.showToast("Please create a password with at least 6 characters.", "warning");
        passwordInput?.focus();
        return;
    }
    if (!signedInCustomer && password !== confirmPassword) {
        window.showToast("Password and confirm password must match.", "warning");
        confirmPasswordInput?.focus();
        return;
    }
    const cartItems = getSafeCart();
    if (cartItems.length === 0) {
        window.showToast("Your cart is empty! Please add a product first.", "warning");
        return;
    }
    try {
        button.disabled = true;
        if (!signedInCustomer) {
            button.innerHTML = 'Creating account... <i class="fa-solid fa-spinner fa-spin text-xs"></i>';
            const registeredUser = await registerAndAuthenticate({ name, email, phone, address, password });
            fillSignedInCustomer(registeredUser || { name, email, phone, address });
        }
        await saveMissingDeliveryAddress(address);
        let referral = null;
        let couponCode = null;
        try {
            const storedReferral = JSON.parse(sessionStorage.getItem("aloraReferral") || "null");
            if (storedReferral) {
                const code = storedReferral.referralCode || storedReferral.ref || storedReferral.code;
                if (code) {
                    referral = { code, clickId: storedReferral.clickId || null };
                    couponCode = code;
                }
            }
        } catch (error) {
            console.warn("Referral data could not be read.", error);
        }
        const inputCoupon = document.getElementById("coupon-input")?.value?.trim()?.toUpperCase();
        const founderHandDelivery = document.getElementById("founder-delivery")?.checked === true;
        let couponCodes = [];
        try {
            couponCodes = JSON.parse(sessionStorage.getItem("aloraAppliedCoupons") || "[]")
                .map((coupon) => coupon.code)
                .filter(Boolean);
        } catch (error) {
            console.warn("Applied coupons could not be read.", error);
        }
        if (inputCoupon) {
            couponCodes.push(inputCoupon);
            couponCode = inputCoupon;
            if (!referral) {
                referral = { code: inputCoupon, clickId: null };
            }
        }
        const response = await fetch(`${BASE_URL}/api/payments/create-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                cart: cartItems,
                customer: { name, email, phone, address },
                referral,
                couponCode,
                couponCodes,
                deliveryOption: { founderHandDelivery }
            })
        });
        const orderData = await response.json();
        if (!response.ok || !orderData.order || !orderData.order.id) {
            window.showToast(orderData.error || "Order could not be created. Please try again.", "error");
            return;
        }
        if (Number(orderData.affiliateDiscount) > 0) {
            window.showToast(`Referral discount applied: ₹${Number(orderData.affiliateDiscount).toFixed(2)}`, "success");
        }
        const options = {
            "key": orderData.razorpay_key_id,
            "amount": orderData.order.amount,
            "currency": orderData.order.currency,
            "name": "ALORA PRODUCTS",
            "description": "Product Purchase",
            "order_id": orderData.order.id,
            "notes": {
                "shipping_address": address,
                "customer_phone": phone,
                "customer_name": name,
                "customer_email": email
            },
            "handler": async function (response) {
                console.log("Razorpay Response:", response);
                try {
                    const verifyResponse = await fetch(`${BASE_URL}/api/payments/verify-payment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            customer: { name, email, phone, address }
                        })
                    });
                    const verificationResult = await verifyResponse.json();
                    if (verificationResult.status === "success") {
                        clearAllCart();
                        showPaymentSuccessPopup(verificationResult.orderData);
                    } else {
                        window.showToast("Payment verification failed. Please contact support with your payment details.", "error", 8000);
                    }
                } catch (error) {
                    console.error("Verification Error:", error);
                    window.showToast("Could not reach the server to verify your payment. Please check your internet connection.", "error", 8000);
                }
            },
            "prefill": {
                "name": name,
                "contact": phone
            },
            "theme": {
                "color": "#A0522D"
            }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
    } catch (error) {
        console.error("Error creating order:", error);
        window.showToast(error.message || "Connection failed! The server may be offline.", "error");
    } finally {
        button.disabled = false;
        button.innerHTML = 'Pay Now <i class="fa-solid fa-arrow-right text-xs"></i>';
    }
});
function showPaymentSuccessPopup(orderInfo) {
    const modal = document.createElement('div');
    modal.id = 'payment-success-modal';
    modal.innerHTML = `
        <div style="
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
            z-index: 9999; font-family: sans-serif;
        ">
            <div style="
                background: #ffffff; padding: 30px; border-radius: 12px;
                text-align: center; max-width: 380px; width: 85%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            ">
                <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
                <h2 style="margin: 0 0 8px 0; color: #2e7d32; font-size: 22px;">Payment Successful!</h2>
                <p style="color: #555; margin: 0 0 20px 0; font-size: 14px; line-height: 1.4;">
                    Aapka order successfully place ho gaya hai.
                </p>
                <button id="download-receipt-btn" style="
                    background-color: #2e7d32; color: white; border: none;
                    padding: 10px 20px; font-size: 14px; border-radius: 6px; cursor: pointer;
                    width: 100%; font-weight: 600; margin-bottom: 10px;
                ">📄 Print / Download Receipt</button>
                <button id="success-ok-btn" style="
                    background-color: #A0522D; color: white; border: none;
                    padding: 12px 24px; font-size: 14px; border-radius: 6px; cursor: pointer;
                    width: 100%; font-weight: 600;
                ">Back to Store</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('download-receipt-btn')?.addEventListener('click', function() {
        printReceipt(orderInfo);
    });
    document.getElementById('success-ok-btn')?.addEventListener('click', function() {
        window.location.href = "./index.html";
    });
}
function printReceipt(info) {
    if (!info) return;
    const itemsRows = (info.cart || []).map((item, idx) => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${idx + 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name} (${item.size || 'Std'})</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price * item.qty}</td>
        </tr>
    `).join('');
    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Receipt - ${info.order_id}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                .box { max-width: 600px; margin: auto; border: 1px solid #ccc; padding: 20px; border-radius: 8px; }
                .hdr { border-bottom: 2px solid #A0522D; padding-bottom: 10px; display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f5f5f5; text-align: left; padding: 8px; }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="hdr">
                    <div>
                        <h2 style="margin:0; color:#A0522D;">ALORA PRODUCTS</h2>
                        <small>Purchase Receipt</small>
                    </div>
                    <div style="text-align:right;">
                        <p style="margin:0;"><strong>Date:</strong> ${info.date || new Date().toLocaleDateString()}</p>
                        <p style="margin:0;"><small>Order ID: ${info.order_id}</small></p>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <p style="margin: 3px 0;"><strong>Customer:</strong> ${info.customer?.name}</p>
                    <p style="margin: 3px 0;"><strong>Phone:</strong> ${info.customer?.phone}</p>
                    <p style="margin: 3px 0;"><strong>Address:</strong> ${info.customer?.address}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th><th>Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itemsRows}</tbody>
                </table>
                <h3 style="text-align:right; margin-top: 20px;">Total Paid: ₹${info.amount}</h3>
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `);
    win.document.close();
}