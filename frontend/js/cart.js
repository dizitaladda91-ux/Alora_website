/* =========================================================
   GLOBAL SYSTEM CONFIGURATION & STATE
   ========================================================= */
const PRIMARY_CART_KEY = "glowCart";
const LEGACY_CART_KEY = "glowRitualCartData";

const FREE_SHIPPING_LIMIT = 499;
const DELIVERY_FEE = 40;
const FOUNDER_DELIVERY_CHARGE = 5000; 

let activeCouponRate = 0;
let activeCouponCode = "";

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
    
    // Updates standard header icons across all dynamic layouts seamlessly
    document.querySelectorAll(".cart-badge, #cart-count").forEach(badge => {
        badge.innerText = totalItems;
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

    addToCart({ id, name, size, price, mrp, qty, img });

    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<i class="fa-solid fa-check text-xs"></i> Added to Cart`;
    btnEl.disabled = true;
    setTimeout(() => {
        btnEl.innerHTML = originalHTML;
        btnEl.disabled = false;
    }, 1200);
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

    let discount = 0;
    if (activeCouponRate > 0) {
        discount = Math.round(subtotal * activeCouponRate);
        if (billDiscountEl) billDiscountEl.innerText = `- ₹${discount}`;
        if (appliedCouponName) appliedCouponName.innerText = activeCouponCode;
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

    const netFinalTotal = subtotal - discount + deliveryFee + extraFounderCharge;
    if (billTotalEl) billTotalEl.innerText = `₹${netFinalTotal}`;
}

function autoFillCoupon(code) {
    const couponInput = document.getElementById("coupon-input");
    if (couponInput) couponInput.value = code;
    applyCoupon();
}

function applyCoupon() {
    const couponInput = document.getElementById("coupon-input");
    const couponMessage = document.getElementById("coupon-message");
    if (!couponInput || !couponMessage) return;
    
    const typedCode = couponInput.value.trim().toUpperCase();
    couponMessage.classList.remove("hidden", "text-emerald-600", "text-red-600");

    if (typedCode === "GLOW10") {
        activeCouponRate = 0.10;
        activeCouponCode = "GLOW10";
        couponMessage.innerText = "Coupon 'GLOW10' applied successfully! (10% Off)";
        couponMessage.classList.add("text-emerald-600");
    } else {
        activeCouponRate = 0;
        activeCouponCode = "";
        couponMessage.innerText = typedCode === "" ? "Please enter a code." : "Invalid coupon. Try 'GLOW10'.";
        couponMessage.classList.add("text-red-600");
    }
    recalculateBill();
}

/* =========================================================
   INITIALIZATION BOOT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
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
window.updateHeaderCartCount = updateHeaderCartCount;