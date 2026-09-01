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
            ${coupon.code} (${coupon.isFlat ? '₹' : ''}${coupon.rate}${coupon.isFlat ? ' off' : '% off'})
            <button type="button" onclick="removeAppliedCoupon('${coupon.code}')" class="ml-1 text-sage hover:text-red-600" aria-label="Remove ${coupon.code}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </span>
    `).join("");
}
function addAppliedCoupon(code, rate, source = "coupon", isFlat = false) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{5,64}$/.test(normalizedCode)) return false;
    if (appliedCoupons.some((coupon) => coupon.code === normalizedCode)) return false;
    if (appliedCoupons.length >= MAX_STACKED_COUPONS) return false;
    appliedCoupons.push({ code: normalizedCode, rate: Number(rate) || 0, source, isFlat: Boolean(isFlat) });
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
function getCart() {
    try {
        let cart1 = [];
        let cart2 = [];
        try {
            const raw1 = localStorage.getItem(PRIMARY_CART_KEY);
            if (raw1) cart1 = JSON.parse(raw1);
        } catch (e) {}
        try {
            const raw2 = localStorage.getItem(LEGACY_CART_KEY);
            if (raw2) cart2 = JSON.parse(raw2);
        } catch (e) {}
        let rawList = [];
        if (Array.isArray(cart1) && cart1.length > 0) {
            rawList = cart1;
        } else if (Array.isArray(cart2) && cart2.length > 0) {
            rawList = cart2;
        } else if (Array.isArray(cart1)) {
            rawList = cart1;
        } else if (Array.isArray(cart2)) {
            rawList = cart2;
        }
        const normalizedCart = rawList.map(item => {
            if (!item || typeof item !== "object") return null;
            const id = String(item.id || item.uniqueCartItemKeyId || item._id || `${item.productId || 'product'}__${item.size || item.activeSelectedSizeConfig || 'Standard'}`);
            const name = String(item.name || item.productName || item.title || 'Alora Skincare Product').trim();
            const size = String(item.size || item.activeSelectedSizeConfig || 'Standard').trim();
            const price = Number(item.price || item.unitPriceItemConfig || 0);
            const mrp = Number(item.mrp || item.comparePrice || item.unitPriceItemConfig || price) || price;
            const qty = Math.max(1, Number(item.qty || item.qtyCountOrderMetric || item.quantity || 1));
            const img = String(item.img || item.baseImg || item.image || item.imageUrl || '/static/placeholder.png');
            return {
                id,
                uniqueCartItemKeyId: id,
                name,
                productName: name,
                size,
                activeSelectedSizeConfig: size,
                price,
                unitPriceItemConfig: price,
                mrp,
                qty,
                qtyCountOrderMetric: qty,
                img,
                baseImg: img
            };
        }).filter(item => item && item.id && item.qty > 0);
        return normalizedCart;
    } catch (e) {
        console.error("Error reading cart records:", e);
        return [];
    }
}
function saveCart(cart) {
    try {
        const jsonStr = JSON.stringify(cart);
        localStorage.setItem(PRIMARY_CART_KEY, jsonStr);
        localStorage.setItem(LEGACY_CART_KEY, jsonStr);
        updateHeaderCartCount();
        if (document.getElementById("cart-items-list")) {
            renderCartPage();
        }
    } catch (e) {
        console.error("Error saving updated cart records:", e);
    }
}
function updateHeaderCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    document.querySelectorAll(".cart-badge, #cart-count, #global-cart-badge, #cart-count-badge, .cart-count-badge").forEach(badge => {
        if (!badge) return;
        badge.innerText = String(totalItems);
        badge.classList.remove("animate-bounce", "scale-125");
        requestAnimationFrame(() => {
            badge.classList.add("scale-125", "transition-transform", "duration-300");
        });
        setTimeout(() => {
            badge.classList.remove("scale-125");
        }, 400);
    });
}
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
function flyToCartAnimation(imgElement) {
    if (!imgElement) return;
    const targetBadge = document.querySelector("#cart-count-badge, .cart-badge, #cart-count, #cart-icon, .fa-cart-shopping");
    if (!targetBadge) return;
    const imgRect = imgElement.getBoundingClientRect();
    const targetRect = targetBadge.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;
    const clone = imgElement.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.top = `${imgRect.top}px`;
    clone.style.left = `${imgRect.left}px`;
    clone.style.width = `${imgRect.width}px`;
    clone.style.height = `${imgRect.height}px`;
    clone.style.borderRadius = "50%";
    clone.style.boxShadow = "0 10px 25px rgba(0,0,0,0.3)";
    clone.style.objectFit = "cover";
    clone.style.zIndex = "99999";
    clone.style.pointerEvents = "none";
    clone.style.transition = "all 0.75s cubic-bezier(0.18, 0.89, 0.32, 1.28)";
    document.body.appendChild(clone);
    requestAnimationFrame(() => {
        clone.style.top = `${targetRect.top + (targetRect.height / 2) - 15}px`;
        clone.style.left = `${targetRect.left + (targetRect.width / 2) - 15}px`;
        clone.style.width = "30px";
        clone.style.height = "30px";
        clone.style.opacity = "0.4";
        clone.style.transform = "scale(0.25) rotate(360deg)";
    });
    setTimeout(() => {
        if (clone.parentNode) {
            clone.parentNode.removeChild(clone);
        }
        updateHeaderCartCount();
    }, 750);
}
window.flyToCartAnimation = flyToCartAnimation;
function toggleCartState(btnEl) {
    const card = btnEl.closest(".product-card");
    if (!card) return;
    const name = card.querySelector(".product-name")?.innerText.trim() || card.querySelector("h3")?.innerText.trim() || "Product";
    const imgEl = card.querySelector("img");
    const img = imgEl?.getAttribute("src") || "";
    const qty = parseInt(card.querySelector(".quantity")?.value) || 1;
    const size = card.dataset.size || card.querySelector(".size-btn.bg-ink")?.innerText.trim() || "Standard";
    const priceText = card.querySelector(".product-price")?.innerText || "0";
    const price = parseInt(card.dataset.price) || parseInt(priceText.replace(/[^\d]/g, "")) || 0;
    const mrpText = card.querySelector(".product-mrp")?.innerText || "";
    const mrp = parseInt(card.dataset.mrp) || (mrpText ? parseInt(mrpText.replace(/[^\d]/g, "")) : price) || price;
    const productId = card.dataset.productId || img; 
    const id = `${productId}__${size}`;
    addToCart({ id, name, size, price, mrp, qty: 1, img });
    if (imgEl) {
        flyToCartAnimation(imgEl);
    }
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<i class="fa-solid fa-check text-xs"></i> ADDED!`;
    btnEl.classList.add("bg-emerald-600", "text-white", "scale-105");
    btnEl.disabled = true;
    updateHeaderCartCount();
    if (typeof loadCartMoreProducts === "function") loadCartMoreProducts();
    setTimeout(() => {
        btnEl.innerHTML = originalHTML;
        btnEl.classList.remove("bg-emerald-600", "text-white", "scale-105");
        btnEl.disabled = false;
    }, 1000);
}
function addToCart(firstArg, nameArg, priceArg, imgArg, qtyArg = 1, sizeArg = "Standard", mrpArg = 0) {
    let itemObj = {};
    if (typeof firstArg === "object" && firstArg !== null) {
        itemObj = firstArg;
    } else if (typeof firstArg === "string" || typeof firstArg === "number") {
        itemObj = {
            id: String(firstArg),
            name: nameArg,
            price: priceArg,
            img: imgArg,
            qty: qtyArg,
            size: sizeArg,
            mrp: mrpArg || priceArg
        };
    } else {
        return;
    }
    const productId = String(itemObj.id || itemObj.uniqueCartItemKeyId || itemObj._id || `${itemObj.productId || 'p'}__${itemObj.size || 'Standard'}`);
    const name = String(itemObj.name || itemObj.productName || 'Alora Skincare Product').trim();
    const size = String(itemObj.size || itemObj.activeSelectedSizeConfig || 'Standard').trim();
    const price = Number(itemObj.price || itemObj.unitPriceItemConfig || 0);
    const mrp = Number(itemObj.mrp || itemObj.comparePrice || price) || price;
    const qty = Math.max(1, Number(itemObj.qty || itemObj.qtyCountOrderMetric || 1));
    const img = String(itemObj.img || itemObj.baseImg || itemObj.image || itemObj.imageUrl || '/static/placeholder.png');
    let cart = getCart();
    let existing = cart.find(item => item.id === productId || item.uniqueCartItemKeyId === productId);
    if (existing) {
        existing.qty = Number(existing.qty || 1) + qty;
        existing.qtyCountOrderMetric = existing.qty;
    } else {
        cart.push({
            id: productId,
            uniqueCartItemKeyId: productId,
            name: name,
            productName: name,
            size: size,
            activeSelectedSizeConfig: size,
            price: price,
            unitPriceItemConfig: price,
            mrp: mrp,
            qty: qty,
            qtyCountOrderMetric: qty,
            img: img,
            baseImg: img
        });
    }
    saveCart(cart);
}
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
    if (typeof loadCartMoreProducts === "function") loadCartMoreProducts();
}
function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    renderCartPage();
    if (typeof loadCartMoreProducts === "function") loadCartMoreProducts();
}
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
    if (billSubtotalEl) billSubtotalEl.innerText = `₹${subtotal}`;
    const flatDiscountTotal = appliedCoupons.filter(c => c.isFlat).reduce((sum, c) => sum + (Number(c.rate) || 0), 0);
    const totalDiscountRate = Math.min(50, appliedCoupons.filter(c => !c.isFlat).reduce((sum, coupon) => sum + (Number(coupon.rate) || 0), 0));
    const percentDiscount = Math.round(subtotal * totalDiscountRate / 100);
    const discount = Math.min(subtotal, percentDiscount + flatDiscountTotal);
    if (discount > 0 && subtotal > 0) {
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
        let customerEmail = "";
        try {
            const userObj = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
            if (userObj?.email) customerEmail = userObj.email;
        } catch (e) {}
        if (!customerEmail) {
            const emailInput = document.getElementById("customer-email");
            if (emailInput) customerEmail = emailInput.value.trim();
        }
        const res = await fetch(`${baseUrl}/api/affiliates/track-click`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: typedCode, customerEmail, landingPage: "/cart.html" })
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
async function loadCartMoreProducts() {
    try {
        const sliderTrack = document.getElementById("cart-product-slider");
        const sectionEl = document.getElementById("more-products-section");
        if (!sliderTrack) return;
        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
        const baseUrl = (window.BASE_URL !== undefined && window.BASE_URL !== null) ? window.BASE_URL : (isLocal ? "http://localhost:5000" : "");
        let products = [];
        try {
            const response = await fetch(`${baseUrl}/api/product/all`);
            if (response.ok) {
                const data = await response.json();
                products = Array.isArray(data) ? data : (data.products || data.data || []);
            }
        } catch (error) {
            console.warn("Could not fetch products from DB API:", error);
        }
        if (!products || products.length === 0) {
            if (sectionEl) sectionEl.classList.add("hidden");
            return;
        }
        const currentCart = getCart();
        const cartProductNames = currentCart.map(item => String(item.name || "").trim().toLowerCase());
        const cartProductIds = currentCart.map(item => String(item.id || item.productId || "").split('__')[0]);
        const filteredProducts = products.filter(product => {
            const pName = String(product.name || "").trim().toLowerCase();
            const pId = String(product._id || product.id || "");
            const isNameInCart = cartProductNames.some(name => name && pName && (name === pName));
            const isIdInCart = cartProductIds.some(id => id && pId && id === pId);
            return !isNameInCart && !isIdInCart;
        });
        const displayProducts = filteredProducts.length > 0 ? filteredProducts : products;
        if (displayProducts.length === 0) {
            if (sectionEl) sectionEl.classList.add("hidden");
            return;
        } else {
            if (sectionEl) sectionEl.classList.remove("hidden");
        }
        const resolveImgUrl = (path) => {
            if (!path) return "/static/placeholder.png";
            if (path.startsWith("http://") || path.startsWith("https://")) return path;
            const cleaned = path.replace(/\\/g, "/").replace(/^\/+/, "");
            return baseUrl ? `${baseUrl}/${cleaned}` : `/${cleaned}`;
        };
        sliderTrack.innerHTML = displayProducts.map(product => {
            const variants = Array.isArray(product.variants) && product.variants.length > 0
                ? product.variants
                : (Array.isArray(product.sizes) && product.sizes.length > 0 
                    ? product.sizes 
                    : [{ volume: 'Standard', price: product.price || 149, comparePrice: product.comparePrice || product.mrp || 499 }]);
            const initialVariant = variants[0];
            const initialPrice = Number(initialVariant.price || product.price || 149);
            const initialComparePrice = Number(initialVariant.comparePrice || initialVariant.mrp || product.comparePrice || product.mrp || 0);
            const discountPercent = initialComparePrice > initialPrice ? Math.round(((initialComparePrice - initialPrice) / initialComparePrice) * 100) : 0;
            const fullImgUrl = resolveImgUrl(product.imagepath || product.imageUrl || (Array.isArray(product.galleryImages) && product.galleryImages[0]));
            const starsHTML = Array.from({ length: 5 }, (_, i) => {
                const rating = Math.round(product.rating || 5);
                if (i < rating) return `<i class="fa-solid fa-star text-amber-400"></i>`;
                return `<i class="fa-regular fa-star text-slate-300"></i>`;
            }).join("");
            const sizeButtonsHTML = variants.map((v, index) => {
                const vol = v.volume || v.size || 'Standard';
                const p = Number(v.price || initialPrice);
                const cp = Number(v.comparePrice || v.mrp || 0);
                return `
                <button type="button" 
                    onclick="selectSize('${vol}', ${p}, ${cp}, this)"
                    class="size-btn px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition border ${index === 0 ? 'bg-ink text-parchment border-ink font-semibold' : 'border-[#DCD3BA] text-ash hover:border-ink'}">
                    ${vol}
                </button>
                `;
            }).join("");
            const slug = String(product.slug || product.name || "product").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
            return `
            <div class="product-card flex-none w-[240px] sm:w-[280px] bg-white rounded-2xl p-3.5 sm:p-4 border border-amber-900/10 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden" 
                 data-product-id="${product._id || product.id}" 
                 data-size="${initialVariant.volume || 'Standard'}" 
                 data-price="${initialPrice}" 
                 data-mrp="${initialComparePrice}">
                ${discountPercent > 0 ? `
                <div class="absolute top-3 right-3 z-10">
                    <span class="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300/40">
                        ${discountPercent}% OFF
                    </span>
                </div>` : ''}
                <div class="w-full flex justify-center items-center h-[130px] sm:h-[160px] overflow-hidden relative my-1">
                    <a href="/product/${encodeURIComponent(slug)}" class="block w-full h-full flex items-center justify-center">
                        <img src="${fullImgUrl}" alt="${product.name}" class="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-105 filter drop-shadow-sm" onerror="this.onerror=null; this.src='/static/placeholder.png'">
                    </a>
                </div>
                <div class="flex-1 flex flex-col justify-between space-y-1 mb-2">
                    <div>
                        <h3 class="product-name text-xs sm:text-sm font-fraunces font-bold text-slate-900 text-center leading-snug group-hover:text-[#8B4513] transition-colors capitalize line-clamp-1">${product.name}</h3>
                        <p class="text-[10px] sm:text-[11px] text-slate-600 text-center font-sans mt-0.5 line-clamp-2 leading-tight">
                            ${product.description || 'Dermatologist-tested luxury skincare.'}
                        </p>
                    </div>
                    <div class="flex items-center justify-center gap-1 text-[11px] text-amber-500 font-bold">
                        <div class="flex gap-0.5 text-amber-500 text-[10px] sm:text-[11px]">${starsHTML}</div>
                        <span class="text-[9px] text-slate-500 font-mono font-semibold">(${product.rating || '4.9'})</span>
                    </div>
                    <div class="flex justify-center items-center gap-1 flex-wrap">
                        ${sizeButtonsHTML}
                    </div>
                    <div class="flex items-baseline justify-center gap-1.5 pt-0.5">
                        <span class="product-price font-fraunces font-bold text-[#8B4513] text-base">₹${initialPrice}</span>
                        <span class="product-mrp text-[11px] line-through text-slate-400 font-mono">${initialComparePrice ? '₹' + initialComparePrice : ''}</span>
                    </div>
                </div>
                <div class="pt-1">
                    <button type="button" onclick="toggleCartState(this)" class="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold py-2.5 rounded-xl text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-amber-500/25 transform active:scale-95">
                        <i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart
                    </button>
                </div>
            </div>
            `;
        }).join("");
        const prevBtn = document.getElementById("cart-prev-btn");
        const nextBtn = document.getElementById("cart-next-btn");
        if (prevBtn) {
            prevBtn.onclick = () => {
                sliderTrack.parentElement.scrollBy({ left: -300, behavior: "smooth" });
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                sliderTrack.parentElement.scrollBy({ left: 300, behavior: "smooth" });
            };
        }
    } catch (error) {
        console.warn("More products slider load warning:", error);
    }
}
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
    loadCartMoreProducts();
    const founderCheckbox = document.getElementById("founder-delivery");
    if (founderCheckbox) {
        founderCheckbox.addEventListener("change", () => {
            recalculateBill();
        });
    }
});
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
