/* =========================================================
   GLOBAL SYSTEM CONFIGURATION & STATE
   ========================================================= */
const PRIMARY_CART_KEY = "glowCart";
const LEGACY_CART_KEY = "glowRitualCartData";

const FREE_SHIPPING_LIMIT = 499;
const DELIVERY_FEE = 40;
const FOUNDER_DELIVERY_CHARGE = 5000; 
const APPLIED_COUPONS_KEY = "aloraAppliedCoupons";
const MAX_STACKED_COUPONS = 3;

let appliedCoupons = [];

try {
    const storedCoupons = JSON.parse(sessionStorage.getItem(APPLIED_COUPONS_KEY) || "[]");
    if (Array.isArray(storedCoupons)) {
        appliedCoupons = storedCoupons.filter((coupon) => /^[A-Z0-9_-]{5,64}$/.test(String(coupon?.code || "")) && Number(coupon.rate) > 0);
    }
} catch (error) {
    console.warn("Applied coupons could not be restored.", error);
}

function persistAppliedCoupons() {
    sessionStorage.setItem(APPLIED_COUPONS_KEY, JSON.stringify(appliedCoupons));
}

function renderAppliedCoupons() {
    const container = document.getElementById("applied-coupons");
    if (!container) return;

    container.innerHTML = appliedCoupons.map((coupon) => `
        <span class="inline-flex items-center gap-1 rounded border border-sage/30 bg-sage-light px-2 py-1 text-xs font-semibold text-sage">
            ${coupon.code} (${coupon.rate}% off)
            <button type="button" onclick="removeAppliedCoupon('${coupon.code}')" class="ml-1 text-sage hover:text-red-600" aria-label="Remove ${coupon.code}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </span>
    `).join("");
}

function addAppliedCoupon(code, rate, source = "coupon") {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{5,64}$/.test(normalizedCode)) return false;
    if (appliedCoupons.some((coupon) => coupon.code === normalizedCode)) return false;
    if (appliedCoupons.length >= MAX_STACKED_COUPONS) return false;

    appliedCoupons.push({ code: normalizedCode, rate: Number(rate) || 0, source });
    persistAppliedCoupons();
    renderAppliedCoupons();
    recalculateBill();
    return true;
}

function removeAppliedCoupon(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    appliedCoupons = appliedCoupons.filter((coupon) => coupon.code !== normalizedCode);
    persistAppliedCoupons();

    try {
        const referral = JSON.parse(sessionStorage.getItem("aloraReferral") || "null");
        if (referral?.referralCode === normalizedCode) sessionStorage.removeItem("aloraReferral");
    } catch (error) {
        console.warn("Referral data could not be updated.", error);
    }

    renderAppliedCoupons();
    recalculateBill();
}

/* =========================================================
   UNIFIED CROSS-PAGE LOCALSTORAGE LAYER (FIXED ACCUMULATION LOOP)
   ========================================================= */
function getCart() {
    try {
        let unifiedCart = [];

        // 1. Read cleanly from your standard primary key
        const primaryData = localStorage.getItem(PRIMARY_CART_KEY);
        if (primaryData) {
            unifiedCart = JSON.parse(primaryData);
        }

        // 2. Intercept alternate page storage key ONLY ONCE
        const legacyData = localStorage.getItem(LEGACY_CART_KEY);
        if (legacyData) {
            const rawLegacyList = JSON.parse(legacyData);

            if (Array.isArray(rawLegacyList) && rawLegacyList.length > 0) {
                rawLegacyList.forEach(legacyItem => {
                    // Check if this item is using old object properties
                    const convertedId = legacyItem.id || legacyItem.uniqueCartItemKeyId || `${legacyItem.productId}__${legacyItem.activeSelectedSizeConfig || 'Standard'}`;
                    const normalizedSize = legacyItem.size || legacyItem.activeSelectedSizeConfig || "Standard";
                    const normalizedQty = parseInt(legacyItem.qty || legacyItem.qtyCountOrderMetric || 0);
                    const normalizedPrice = parseInt(legacyItem.price || legacyItem.unitPriceItemConfig || 0);
                    
                    if (!convertedId || normalizedQty <= 0) return;

                    // Search if it already exists in the primary cart array to prevent duplicate math stacking
                    let existingItem = unifiedCart.find(i => i.id === convertedId);
                    if (existingItem) {
                        // If it matches an item already in unifiedCart, use the maximum or keep primary
                        // change to existingItem.qty = normalizedQty if you want it to perfectly overwrite
                    } else {
                        unifiedCart.push({
                            id: convertedId,
                            name: legacyItem.name || legacyItem.productName || "Product",
                            size: normalizedSize,
                            price: normalizedPrice,
                            mrp: parseInt(legacyItem.mrp || legacyItem.unitPriceItemConfig || normalizedPrice),
                            qty: normalizedQty,
                            img: legacyItem.img || legacyItem.baseImg || ""
                        });
                    }
                });

                // Write the clean, merged list to the primary key
                localStorage.setItem(PRIMARY_CART_KEY, JSON.stringify(unifiedCart));
            }
            
            // 3. CRITICAL: Wipe out the legacy key completely so it NEVER loops on next load/refresh!
            localStorage.removeItem(LEGACY_CART_KEY);
        }

        return unifiedCart;
    } catch (e) {
        console.error("Error reading or merging cross-page cart records:", e);
        return [];
    }
}
function saveCart(cart) {
    try {
        // Save the aligned layout structure to both keys simultaneously
        localStorage.setItem(PRIMARY_CART_KEY, JSON.stringify(cart));
        localStorage.setItem(LEGACY_CART_KEY, JSON.stringify(cart));
        updateHeaderCartCount();
    } catch (e) {
        console.error("Error saving updated cart records:", e);
    }
}

/* =========================================================
   GLOBAL UI COUNTER BADGES (ALL PAGES)
   ========================================================= */
function updateHeaderCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    
    // Updates standard header icons and floating cart count badges across all layouts
    document.querySelectorAll(".cart-badge, #cart-count, #global-cart-badge, #cart-count-badge, .cart-count-badge").forEach(badge => {
        if (!badge) return;
        badge.innerText = totalItems;
        
        // Dynamic Bounce & Scale Pulse Animation on Cart Quantity Increase
        badge.classList.remove("animate-bounce", "scale-125");
        void badge.offsetWidth; // trigger DOM reflow
        badge.classList.add("scale-125", "transition-transform", "duration-300");
        setTimeout(() => {
            badge.classList.remove("scale-125");
        }, 400);
    });
}

/* =========================================================
   CATALOG / PRODUCT LISTING INTERFACES
   ========================================================= */
function selectSize(size, price, mrp, btnEl) {
    const card = btnEl.closest(".product-card");
    if (!card) {
        if (typeof window.selectSizeDetail === 'function') {
            window.selectSizeDetail(size, price, mrp, btnEl);
        }
        return;
    }

    card.dataset.size = size;
    card.dataset.price = price;
    card.dataset.mrp = mrp;

    card.querySelectorAll(".size-btn").forEach(b => {
        b.classList.remove("bg-ink", "text-parchment", "border-ink", "font-semibold");
        b.classList.add("border-[#DCD3BA]", "text-ash");
    });
    btnEl.classList.add("bg-ink", "text-parchment", "border-ink", "font-semibold");
    btnEl.classList.remove("border-[#DCD3BA]", "text-ash");

    const priceEl = card.querySelector(".product-price");
    const mrpEl = card.querySelector(".product-mrp");
    if (priceEl) priceEl.innerText = `₹${price}`;
    if (mrpEl) mrpEl.innerText = mrp ? `₹${mrp}` : '';
}

function updateQty(amount, btnEl) {
    const card = btnEl ? btnEl.closest(".product-card") : null;
    
    if (card) {
        const input = card.querySelector(".quantity");
        if (input) {
            let val = parseInt(input.value) || 1;
            val += amount;
            if (val < 1) val = 1;
            input.value = val;
        }
    } else {
        const qtyInput = document.getElementById('quantity');
        if (qtyInput) {
            let val = parseInt(qtyInput.value) || 1;
            val += amount;
            if (val < 1) val = 1;
            qtyInput.value = val;
        }
    }
}

function toggleCartState(btnEl) {
    const card = btnEl.closest(".product-card");
    if (!card) return;

    const name = card.querySelector(".product-name")?.innerText.trim() || card.querySelector("h3")?.innerText.trim() || "Product";
    const img = card.querySelector("img")?.getAttribute("src") || "";
    const qty = parseInt(card.querySelector(".quantity")?.value) || 1;
    const size = card.dataset.size || card.querySelector(".size-btn.bg-ink")?.innerText.trim() || "Standard";
    
    const priceText = card.querySelector(".product-price")?.innerText || "0";
    const price = parseInt(card.dataset.price) || parseInt(priceText.replace(/[^\d]/g, "")) || 0;
    
    const mrpText = card.querySelector(".product-mrp")?.innerText || "";
    const mrp = parseInt(card.dataset.mrp) || (mrpText ? parseInt(mrpText.replace(/[^\d]/g, "")) : price) || price;

    const productId = card.dataset.productId || img; 
    const id = `${productId}__${size}`;

    addToCart({ id, name, size, price, mrp, qty: 1, img });

    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<i class="fa-solid fa-check text-xs"></i> ADDED!`;
    btnEl.classList.add("bg-emerald-600", "text-white", "scale-105");
    btnEl.disabled = true;

    updateHeaderCartCount();

    setTimeout(() => {
        btnEl.innerHTML = originalHTML;
        btnEl.classList.remove("bg-emerald-600", "text-white", "scale-105");
        btnEl.disabled = false;
    }, 1000);
}

function addToCart(product) {
    const cart = getCart();
    const existing = cart.find(item => item.id === product.id);

    if (existing) {
        existing.qty += product.qty;
    } else {
        cart.push(product);
    }

    saveCart(cart);
}

/* =========================================================
   CHECKOUT BAG / CART UI PAGE RENDER MANAGEMENT
   ========================================================= */
function renderCartPage() {
    const listEl = document.getElementById("cart-items-list");
    if (!listEl) return; 

    const cart = getCart();
    const emptyState = document.getElementById("empty-cart-state");
    const summaryPanel = document.getElementById("summary-panel");
    const cartCountBadgeTop = document.getElementById("cart-count-badge");

    if (cart.length === 0) {
        listEl.innerHTML = "";
        if (emptyState) emptyState.classList.remove("hidden");
        if (summaryPanel) summaryPanel.classList.add("hidden");
        if (cartCountBadgeTop) cartCountBadgeTop.innerText = "0 Items";
        updateHeaderCartCount();
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (summaryPanel) summaryPanel.classList.remove("hidden");

    listEl.innerHTML = cart.map(item => `
        <div class="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-[#ECE4CE] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition hover:shadow-md" data-cart-id="${item.id}">
            <div class="flex gap-4 items-center w-full sm:w-auto">
                <div class="bg-white rounded-xl w-24 h-24 flex-shrink-0 flex items-center justify-center border border-[#E7DFC7] overflow-hidden">
                    <img src="${item.img}" alt="${item.name}" class="w-full h-full object-contain p-2 transition-transform duration-300 hover:scale-105">
                </div>
                <div>
                    <h3 class="font-serif font-semibold text-ink text-base">${item.name}</h3>
                    <p class="text-xs text-ash mt-1">
                        <span class="font-medium">Size:</span> <span class="bg-sage-light text-sage font-semibold px-2 py-0.5 rounded">${item.size}</span>
                    </p>
                    <p class="text-xs text-emerald-600 font-semibold mt-1.5"><i class="fa-solid fa-check me-1"></i>In Stock</p>
                </div>
            </div>

            <div class="flex sm:flex-row flex-row-reverse sm:items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-[#ECE4CE]">
                <div class="text-right">
                    <span class="font-serif font-semibold text-ink text-lg block">₹${item.price * item.qty}</span>
                    <span class="text-xs text-ash block">₹${item.price} / unit</span>
                </div>

                <div class="flex items-center border border-[#DCD3BA] rounded-lg overflow-hidden bg-[#FAF7EE] h-9">
                    <button type="button" onclick="changeCartQty('${item.id}', -1)" class="w-8 h-full bg-white text-ink hover:bg-[#F1EBD7] font-bold transition flex items-center justify-center text-sm">−</button>
                    <input type="number" value="${item.qty}" min="1" readonly class="w-10 h-full bg-white text-center font-semibold text-ink text-xs focus:outline-none">
                    <button type="button" onclick="changeCartQty('${item.id}', 1)" class="w-8 h-full bg-white text-ink hover:bg-[#F1EBD7] font-bold transition flex items-center justify-center text-sm">+</button>
                </div>

                <button type="button" onclick="removeFromCart('${item.id}')" class="text-ash hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50" title="Remove item">
                    <i class="fa-regular fa-trash-can text-lg"></i>
                </button>
            </div>
        </div>
    `).join("");

    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    if (cartCountBadgeTop) cartCountBadgeTop.innerText = `${totalItems} ${totalItems === 1 ? "Item" : "Items"}`;

    recalculateBill();
    updateHeaderCartCount();
}

function changeCartQty(id, amount) {
    const cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.qty += amount;
    if (item.qty < 1) {
        removeFromCart(id);
        return;
    }
    saveCart(cart);
    renderCartPage();
}

function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    renderCartPage();
}

/* =========================================================
   BILLING AND CALCULATIONS ENGINE
   ========================================================= */
function recalculateBill() {
    const cart = getCart();
    const billSubtotalEl = document.getElementById("bill-subtotal");
    const billDiscountEl = document.getElementById("bill-discount");
    const discountRow = document.getElementById("discount-row");
    const billDeliveryEl = document.getElementById("bill-delivery");
    const billTotalEl = document.getElementById("bill-total");
    const shippingAlert = document.getElementById("shipping-alert");
    const shippingNeededEl = document.getElementById("shipping-needed");
    const appliedCouponName = document.getElementById("applied-coupon-name");
    
    const founderCheckbox = document.getElementById("founder-delivery");

    if (!billSubtotalEl) return;

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    billSubtotalEl.innerText = `₹${subtotal}`;

    const totalDiscountRate = Math.min(50, appliedCoupons.reduce((sum, coupon) => sum + (Number(coupon.rate) || 0), 0));
    const discount = Math.round(subtotal * totalDiscountRate / 100);

    if (totalDiscountRate > 0 && subtotal > 0) {
        if (billDiscountEl) billDiscountEl.innerText = `${discount}`;
        if (appliedCouponName) appliedCouponName.innerText = appliedCoupons.map((coupon) => coupon.code).join(" + ");
        if (discountRow) discountRow.classList.remove("hidden");
    } else {
        if (discountRow) discountRow.classList.add("hidden");
    }

    let deliveryFee = DELIVERY_FEE;
    if (subtotal === 0) {
        deliveryFee = 0;
        if (billDeliveryEl) billDeliveryEl.innerText = `₹0`;
        if (shippingAlert) shippingAlert.classList.add("hidden");
    } else if (subtotal >= FREE_SHIPPING_LIMIT) {
        deliveryFee = 0;
        if (billDeliveryEl) billDeliveryEl.innerHTML = `<span class="text-emerald-600 font-semibold">FREE</span> <span class="line-through text-gray-400 text-xs">₹${DELIVERY_FEE}</span>`;
        if (shippingAlert) shippingAlert.classList.add("hidden");
    } else {
        if (billDeliveryEl) billDeliveryEl.innerText = `₹${deliveryFee}`;
        if (shippingAlert) shippingAlert.classList.remove("hidden");
        if (shippingNeededEl) shippingNeededEl.innerText = `₹${FREE_SHIPPING_LIMIT - subtotal}`;
    }

    let extraFounderCharge = 0;
    if (founderCheckbox && founderCheckbox.checked && subtotal > 0) {
        extraFounderCharge = FOUNDER_DELIVERY_CHARGE;
    }

    const netFinalTotal = Math.max(0, subtotal - discount + deliveryFee + extraFounderCharge);
    if (billTotalEl) billTotalEl.innerText = `₹${netFinalTotal}`;
}

function autoFillCoupon(code) {
    const couponInput = document.getElementById("coupon-input");
    if (couponInput) couponInput.value = code;
    applyCoupon();
}

async function applyCoupon() {
    const couponInput = document.getElementById("coupon-input");
    const couponMessage = document.getElementById("coupon-message");
    if (!couponInput || !couponMessage) return;
    
    const typedCode = couponInput.value.trim().toUpperCase();
    couponMessage.classList.remove("hidden", "text-emerald-600", "text-red-600");

    if (!typedCode) {
        couponMessage.innerText = "Please enter a coupon or referral code.";
        couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
        recalculateBill();
        return;
    }

    if (typedCode === "RAKHI30" || typedCode === "RAKHI" || typedCode === "FESTIVE30" || typedCode === "RAKHI30OFF") {
        if (addAppliedCoupon(typedCode, 30)) {
            couponMessage.innerText = `🪔 Rakhi Special Coupon '${typedCode}' applied successfully! (30% Off)`;
            couponMessage.className = "text-xs font-semibold mt-2 text-emerald-600 block";
            couponInput.value = "";
        } else {
            couponMessage.innerText = appliedCoupons.some((coupon) => coupon.code === typedCode) ? "This coupon is already applied." : "You can apply up to 3 coupons.";
            couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
        }
        return;
    }

    if (typedCode === "GLOW10") {
        if (addAppliedCoupon(typedCode, 10)) {
            couponMessage.innerText = "Coupon 'GLOW10' applied successfully! (10% Off)";
            couponMessage.className = "text-xs font-semibold mt-2 text-emerald-600 block";
            couponInput.value = "";
        } else {
            couponMessage.innerText = appliedCoupons.some((coupon) => coupon.code === typedCode) ? "This coupon is already applied." : "You can apply up to 3 coupons.";
            couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
        }
        return;
    }

    let refData = null;
    try { refData = JSON.parse(sessionStorage.getItem("aloraReferral") || "null"); } catch (e) {}

    if (refData && refData.referralCode === typedCode) {
        const discountPercent = Number(refData.discountPercent) || 10;
        if (addAppliedCoupon(typedCode, discountPercent, "referral")) {
            couponMessage.innerText = `Referral Code '${typedCode}' applied! (${discountPercent}% Off)`;
            couponMessage.className = "text-xs font-semibold mt-2 text-emerald-600 block";
            couponInput.value = "";
        } else {
            couponMessage.innerText = appliedCoupons.some((coupon) => coupon.code === typedCode) ? "This coupon is already applied." : "You can apply up to 3 coupons.";
            couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
        }
        return;
    }

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const baseUrl = (window.BASE_URL !== undefined && window.BASE_URL !== null) ? window.BASE_URL : (isLocal ? "http://localhost:5000" : "");

    try {
        couponMessage.innerText = "Validating code...";
        couponMessage.className = "text-xs font-semibold mt-2 text-ash block";

        const res = await fetch(`${baseUrl}/api/affiliates/track-click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: typedCode, landingPage: "/cart.html" })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            const clickId = data.clickId || null;
            const discountPercent = Number(data.discountPercent) || 0;
            if (!clickId || discountPercent <= 0) throw new Error("Affiliate tracking response was incomplete.");
            if (appliedCoupons.some((coupon) => coupon.source === "referral")) {
                couponMessage.innerText = "Only one referral coupon can be combined with other coupons.";
                couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
            } else if (addAppliedCoupon(typedCode, discountPercent, "referral")) {
                sessionStorage.setItem("aloraReferral", JSON.stringify({
                    referralCode: typedCode,
                    clickId,
                    discountPercent
                }));
                couponMessage.innerText = `Referral Code '${typedCode}' applied! (${discountPercent}% Off)`;
                couponMessage.className = "text-xs font-semibold mt-2 text-emerald-600 block";
                couponInput.value = "";
                if (typeof window.showReferralBanner === "function") {
                    window.showReferralBanner(typedCode, discountPercent);
                }
            } else {
                couponMessage.innerText = appliedCoupons.some((coupon) => coupon.code === typedCode) ? "This coupon is already applied." : "You can apply up to 3 coupons.";
                couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
            }
        } else {
            couponMessage.innerText = data.message || "Invalid coupon or referral code.";
            couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
        }
    } catch (err) {
        couponMessage.innerText = "Could not validate code. Try 'GLOW10'.";
        couponMessage.className = "text-xs font-semibold mt-2 text-red-600 block";
    }
    recalculateBill();
}

/* =========================================================
   INITIALIZATION BOOT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    try {
        const referral = JSON.parse(sessionStorage.getItem("aloraReferral") || "null");
        if (referral?.referralCode && !appliedCoupons.some((coupon) => coupon.code === referral.referralCode)) {
            addAppliedCoupon(referral.referralCode, Number(referral.discountPercent) || 10, "referral");
        }
    } catch (error) {
        console.warn("Referral data could not be restored.", error);
    }
    renderAppliedCoupons();
    updateHeaderCartCount();
    renderCartPage(); 

    const founderCheckbox = document.getElementById("founder-delivery");
    if (founderCheckbox) {
        founderCheckbox.addEventListener("change", () => {
            recalculateBill();
        });
    }
});

// Expose hooks globally
window.selectSize = selectSize;
window.updateQty = updateQty;
window.toggleCartState = toggleCartState;
window.addToCart = addToCart;
window.changeCartQty = changeCartQty;
window.removeFromCart = removeFromCart;
window.autoFillCoupon = autoFillCoupon;
window.applyCoupon = applyCoupon;
window.removeAppliedCoupon = removeAppliedCoupon;
window.updateHeaderCartCount = updateHeaderCartCount;
window.recalculateBill = recalculateBill;
