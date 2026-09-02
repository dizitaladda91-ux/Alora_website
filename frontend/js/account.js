import BASE_URL, { getAuthHeaders } from "./config.js";
import { fetchUserWishlist, toggleProductWishlist } from "./wishlist.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;

let cachedOrders = [];
let activeOrderFilter = "all";

// ==========================================
// 1. TAB NAVIGATION CONTROLLER
// ==========================================
export function switchAccountTab(tabName) {
    const validTabs = ["orders", "buy-again", "wishlist", "profile"];
    if (!validTabs.includes(tabName)) tabName = "orders";

    // Update Tab Buttons (Desktop & Mobile)
    document.querySelectorAll("[data-tab-target]").forEach(btn => {
        if (btn.dataset.tabTarget === tabName) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Toggle Content Panels
    document.querySelectorAll(".account-panel").forEach(panel => {
        panel.classList.add("hidden");
    });

    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) {
        targetPanel.classList.remove("hidden");
    }

    // Update URL hash without jumping
    if (window.location.hash !== `#${tabName}`) {
        history.replaceState(null, null, `#${tabName}`);
    }

    // Trigger tab-specific loader
    if (tabName === "orders") loadMyOrders();
    else if (tabName === "buy-again") loadBuyAgainItems();
    else if (tabName === "wishlist") loadWishlistTab();
    else if (tabName === "profile") loadProfileDetails();
}

window.switchAccountTab = switchAccountTab;

// ==========================================
// 2. TOAST NOTIFICATIONS
// ==========================================
export function showToast(message, type = "success") {
    const toast = document.getElementById("account-toast");
    const toastText = document.getElementById("account-toast-text");
    if (!toast || !toastText) return;

    toastText.innerText = message;
    toast.className = `rounded-2xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-md transition-all duration-300 ${
        type === "success" 
            ? "bg-emerald-50 text-emerald-900 border border-emerald-300" 
            : type === "error"
            ? "bg-rose-50 text-rose-900 border border-rose-300"
            : "bg-amber-50 text-amber-900 border border-amber-300"
    }`;
    toast.classList.remove("hidden");

    setTimeout(() => {
        toast.classList.add("hidden");
    }, 4500);
}
window.showToastNotification = showToast;

// ==========================================
// 3. TAB 1: MY ORDERS & TRACKING
// ==========================================
const orderStatusInfo = (status) => {
    const states = {
        paid: ["Order Confirmed", "Your payment is confirmed. We will prepare your package shortly.", 0],
        processing: ["Processing & Formulation", "Our lab is packaging your fresh skincare ritual.", 1],
        packed: ["Packed & Sealed", "Your luxury parcel has been sealed and handed to courier.", 2],
        shipped: ["Dispatched / In Transit", "Your package is on its way to your delivery address.", 3],
        delivered: ["Delivered", "Your package has been successfully delivered.", 4],
        cancelled: ["Cancelled", "This order was cancelled.", -1],
        refunded: ["Refunded", "Your payment has been refunded to the source account.", -1]
    };
    const [label, message, step] = states[String(status || "paid").toLowerCase()] || states.paid;
    return { label, message, step };
};

const renderProgressStepper = (step) => {
    if (step < 0) return "";
    const stages = ["Booked", "Processing", "Packed", "Shipped", "Delivered"];
    return `
    <div class="grid grid-cols-5 gap-1 mt-4">
        ${stages.map((stage, index) => `
            <div class="text-center">
                <div class="h-1.5 rounded-full ${index <= step ? "bg-[#8B4513]" : "bg-stone-200"} transition-all"></div>
                <p class="mt-1.5 text-[9px] sm:text-[10px] ${index <= step ? "text-[#8B4513] font-bold" : "text-stone-400"}">${stage}</p>
            </div>
        `).join("")}
    </div>`;
};

async function loadMyOrders() {
    const loader = document.getElementById("orders-loader");
    const container = document.getElementById("orders-container");
    const emptyState = document.getElementById("orders-empty-state");
    if (!container) return;

    if (loader) loader.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    try {
        const response = await fetch(`${BASE_URL}/api/orders/my`, { 
            headers: getAuthHeaders(), 
            credentials: "include" 
        });

        if (response.status === 401) {
            window.location.href = "./login.html";
            return;
        }

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Could not load your orders.");

        cachedOrders = result.data || [];
        if (loader) loader.classList.add("hidden");

        renderFilteredOrders();
    } catch (error) {
        if (loader) loader.innerHTML = `<p class="text-rose-600 text-sm font-semibold">${escapeHtml(error.message)}</p>`;
    }
}

export function filterOrders(type, btnEl) {
    activeOrderFilter = type;
    document.querySelectorAll(".order-filter-btn").forEach(btn => {
        btn.className = "order-filter-btn px-3 py-1.5 rounded-lg text-stone-600 hover:text-stone-900 transition cursor-pointer";
    });
    if (btnEl) {
        btnEl.className = "order-filter-btn px-3 py-1.5 rounded-lg bg-[#8B4513] text-white font-bold transition";
    }
    renderFilteredOrders();
}
window.filterOrders = filterOrders;

function renderFilteredOrders() {
    const container = document.getElementById("orders-container");
    const emptyState = document.getElementById("orders-empty-state");
    if (!container) return;

    let list = cachedOrders;
    if (activeOrderFilter === "active") {
        list = cachedOrders.filter(o => !["delivered", "cancelled", "refunded"].includes(String(o.orderStatus || "").toLowerCase()));
    } else if (activeOrderFilter === "delivered") {
        list = cachedOrders.filter(o => String(o.orderStatus || "").toLowerCase() === "delivered");
    }

    if (!list.length) {
        container.innerHTML = "";
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    container.innerHTML = list.map(order => {
        const status = orderStatusInfo(order.orderStatus);
        const isPaid = String(order.paymentStatus || "").toLowerCase() === "paid";
        const expectedDelivery = order.expectedDeliveryDate 
            ? new Date(order.expectedDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) 
            : "2–4 Business Days";
        const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

        return `
        <article class="bg-[#FAF7EE]/50 rounded-2xl border border-[#ECE4CE] p-4 sm:p-6 transition hover:shadow-md">
            <!-- Order Header -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold uppercase tracking-wider text-[#8B4513]">Order ID</span>
                        <span class="font-mono text-xs font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-stone-200 select-all">${escapeHtml(order.razorpayOrderId)}</span>
                    </div>
                    <p class="text-xs text-stone-500 mt-1">Placed on ${orderDate}</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isPaid ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800'}">
                        ${escapeHtml(order.paymentStatus)}
                    </span>
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#8B4513]/10 text-[#8B4513] border border-[#8B4513]/20">
                        ${escapeHtml(status.label)}
                    </span>
                </div>
            </div>

            <!-- Delivery Progress Card -->
            <div class="mt-4 rounded-xl bg-white border border-[#ECE4CE] p-4 shadow-2xs">
                <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded-full bg-amber-100 text-[#8B4513] flex items-center justify-center text-sm shrink-0">
                        <i class="fa-solid fa-truck-fast"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs sm:text-sm font-bold text-slate-900">${escapeHtml(status.label)}</p>
                        <p class="text-xs text-stone-600 mt-0.5">${escapeHtml(status.message)}</p>
                        ${status.step >= 0 && status.step < 4 ? `
                            <p class="text-xs font-semibold text-[#8B4513] mt-1.5 flex items-center gap-1.5">
                                <i class="fa-regular fa-clock text-xs"></i> Est. Delivery: ${escapeHtml(expectedDelivery)}
                            </p>
                        ` : ''}
                    </div>
                </div>
                ${renderProgressStepper(status.step)}
            </div>

            <!-- Items List -->
            <div class="py-4 divide-y divide-stone-100">
                ${order.items.map(item => `
                    <div class="py-3 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-12 h-12 bg-white rounded-lg border border-[#ECE4CE] flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                <img src="${item.image || item.imageUrl || '/static/placeholder.png'}" alt="${escapeHtml(item.name)}" class="w-full h-full object-contain" onerror="this.src='/static/placeholder.png'">
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-slate-900 text-xs sm:text-sm truncate">${escapeHtml(item.name)}</h4>
                                <p class="text-[11px] text-stone-500 mt-0.5">
                                    Size: <span class="font-semibold text-stone-700">${escapeHtml(item.variant || item.size || 'Standard')}</span> &bull; Qty: <span class="font-semibold text-stone-700">${item.quantity || item.qty || 1}</span>
                                </p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-bold text-slate-900 text-sm">${money(item.lineTotal || (item.price * (item.quantity || 1)))}</span>
                            <button type="button" onclick="quickReorder('${escapeHtml(item.name)}', '${escapeHtml(item.variant || 'Standard')}', ${item.price || 0})" class="block text-[11px] text-[#8B4513] font-bold hover:underline mt-0.5">
                                Re-order <i class="fa-solid fa-arrow-right text-[9px]"></i>
                            </button>
                        </div>
                    </div>
                `).join("")}
            </div>

            <!-- Order Total & Footer Summary -->
            <div class="border-t border-stone-200/80 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div class="text-stone-500">
                    <span>Delivered to: </span>
                    <span class="font-semibold text-slate-800">${escapeHtml(order.customer?.address || 'Shipping Address')}</span>
                </div>
                <div class="text-right">
                    <span class="text-stone-500">Total Paid: </span>
                    <span class="font-fraunces font-bold text-slate-900 text-base sm:text-lg">${money(order.totalAmount)}</span>
                </div>
            </div>
        </article>`;
    }).join("");
}

export function quickReorder(name, size, price) {
    if (typeof window.addToCart === "function") {
        window.addToCart({
            id: `${name}__${size}`,
            name: name,
            size: size,
            price: price,
            qty: 1
        });
        showToast(`Added '${name}' to your cart!`, "success");
    } else {
        window.location.href = "/products";
    }
}
window.quickReorder = quickReorder;

// ==========================================
// 4. TAB 2: BUY AGAIN PRODUCTS
// ==========================================
async function loadBuyAgainItems() {
    const loader = document.getElementById("buy-again-loader");
    const grid = document.getElementById("buy-again-grid");
    const emptyState = document.getElementById("buy-again-empty");
    if (!grid) return;

    if (loader) loader.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    try {
        const response = await fetch(`${BASE_URL}/api/orders/buy-again`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        const result = await response.json();
        if (loader) loader.classList.add("hidden");

        const products = result.data || [];
        if (!products.length) {
            grid.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");

        grid.innerHTML = products.map(p => {
            const initialPrice = p.price || 149;
            const comparePrice = p.comparePrice || p.mrp || 0;
            const slug = String(p.slug || p.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
            const img = p.imagepath || p.imageUrl || p.image || "/static/placeholder.png";

            return `
            <div class="product-card bg-[#FAF7EE]/60 rounded-2xl p-4 border border-[#ECE4CE] flex flex-col justify-between hover:shadow-md transition">
                <div>
                    <div class="w-full h-36 bg-white rounded-xl border border-[#ECE4CE] flex items-center justify-center p-2 mb-3 overflow-hidden">
                        <a href="/product/${encodeURIComponent(slug)}" class="w-full h-full flex items-center justify-center">
                            <img src="${img}" alt="${escapeHtml(p.name)}" class="w-full h-full object-contain hover:scale-105 transition-transform duration-300" onerror="this.src='/static/placeholder.png'">
                        </a>
                    </div>
                    <h3 class="product-name font-fraunces font-bold text-sm text-slate-900 line-clamp-1 capitalize">${escapeHtml(p.name)}</h3>
                    <p class="text-[11px] text-stone-500 line-clamp-1 mt-0.5">${escapeHtml(p.preferredVariant || 'Standard')}</p>
                    <div class="flex items-baseline gap-2 mt-2">
                        <span class="product-price font-fraunces font-bold text-[#8B4513] text-base">${money(initialPrice)}</span>
                        ${comparePrice > initialPrice ? `<span class="product-mrp text-xs line-through text-stone-400">${money(comparePrice)}</span>` : ''}
                    </div>
                </div>
                <div class="mt-4 pt-2">
                    <button type="button" onclick="buyAgainAddToCart(this, '${escapeHtml(p.name)}', '${escapeHtml(p.preferredVariant || 'Standard')}', ${initialPrice}, '${img}')" class="w-full bg-[#8B4513] hover:bg-[#6F370F] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart
                    </button>
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        if (loader) loader.innerHTML = `<p class="text-stone-500 text-sm">Could not load repeat items.</p>`;
    }
}

export function buyAgainAddToCart(btnEl, name, size, price, img) {
    if (typeof window.addToCart === "function") {
        window.addToCart({
            id: `${name}__${size}`,
            name,
            size,
            price,
            img,
            qty: 1
        });
        const orig = btnEl.innerHTML;
        btnEl.innerHTML = `<i class="fa-solid fa-check"></i> Added!`;
        btnEl.classList.add("bg-emerald-600");
        setTimeout(() => {
            btnEl.innerHTML = orig;
            btnEl.classList.remove("bg-emerald-600");
        }, 1200);
        showToast(`'${name}' added to cart!`, "success");
    }
}
window.buyAgainAddToCart = buyAgainAddToCart;

// ==========================================
// 5. TAB 3: WISHLIST LOADER & CONTROLS
// ==========================================
async function loadWishlistTab() {
    const loader = document.getElementById("wishlist-loader");
    const grid = document.getElementById("wishlist-grid");
    const emptyState = document.getElementById("wishlist-empty");
    const headerCount = document.getElementById("wishlist-header-count");
    if (!grid) return;

    if (loader) loader.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    try {
        const list = await fetchUserWishlist();
        if (loader) loader.classList.add("hidden");

        if (headerCount) headerCount.innerText = `${list.length} ${list.length === 1 ? 'Item' : 'Items'}`;

        if (!list.length) {
            grid.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");

        grid.innerHTML = list.map(item => {
            const isObj = typeof item === "object" && item !== null;
            const id = isObj ? (item._id || item.id) : item;
            const name = isObj ? (item.name || "Skincare Product") : "Alora Product";
            const price = isObj ? (item.price || 149) : 149;
            const img = isObj ? (item.imagepath || item.imageUrl || "/static/placeholder.png") : "/static/placeholder.png";
            const slug = isObj ? (item.slug || String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")) : "product";

            return `
            <div class="bg-[#FAF7EE]/60 rounded-2xl p-4 border border-[#ECE4CE] flex flex-col justify-between hover:shadow-md transition relative group">
                <button type="button" onclick="removeFromWishlistTab('${id}', this)" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white text-stone-400 hover:text-rose-600 border border-stone-200 flex items-center justify-center transition shadow-2xs z-10" title="Remove from wishlist">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
                <div>
                    <div class="w-full h-36 bg-white rounded-xl border border-[#ECE4CE] flex items-center justify-center p-2 mb-3 overflow-hidden">
                        <a href="/product/${encodeURIComponent(slug)}" class="w-full h-full flex items-center justify-center">
                            <img src="${img}" alt="${escapeHtml(name)}" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" onerror="this.src='/static/placeholder.png'">
                        </a>
                    </div>
                    <h3 class="font-fraunces font-bold text-sm text-slate-900 line-clamp-1 capitalize">${escapeHtml(name)}</h3>
                    <p class="font-fraunces font-bold text-[#8B4513] text-base mt-1.5">${money(price)}</p>
                </div>
                <div class="mt-4 pt-2">
                    <button type="button" onclick="moveWishlistToCart('${id}', '${escapeHtml(name)}', ${price}, '${img}', this)" class="w-full bg-[#8B4513] hover:bg-[#6F370F] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-cart-shopping text-xs"></i> Move to Cart
                    </button>
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        if (loader) loader.innerHTML = `<p class="text-stone-500 text-sm">Could not load wishlist.</p>`;
    }
}

export async function removeFromWishlistTab(productId, btnEl) {
    await toggleProductWishlist(productId);
    loadWishlistTab();
    showToast("Removed from wishlist.", "info");
}
window.removeFromWishlistTab = removeFromWishlistTab;

export async function moveWishlistToCart(productId, name, price, img, btnEl) {
    if (typeof window.addToCart === "function") {
        window.addToCart({
            id: `${productId}__Standard`,
            name,
            size: "Standard",
            price,
            img,
            qty: 1
        });
    }
    await toggleProductWishlist(productId);
    loadWishlistTab();
    showToast(`'${name}' moved to cart!`, "success");
}
window.moveWishlistToCart = moveWishlistToCart;

// ==========================================
// 6. TAB 4: PROFILE MANAGEMENT FORM
// ==========================================
export function selectTitle(val, btnEl) {
    document.getElementById("prof-title").value = val;
    document.querySelectorAll(".title-pill").forEach(p => p.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");
}
window.selectTitle = selectTitle;

export function selectGender(val, btnEl) {
    document.getElementById("prof-gender").value = val;
    document.querySelectorAll(".gender-pill").forEach(p => p.classList.remove("selected"));
    if (btnEl) btnEl.classList.add("selected");
}
window.selectGender = selectGender;

async function loadProfileDetails() {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/session`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });

        if (!response.ok) return;
        const result = await response.json();
        const user = result.user || {};

        // Populate Form Fields
        const nameInput = document.getElementById("prof-name");
        const phoneInput = document.getElementById("prof-phone");
        const emailInput = document.getElementById("prof-email");
        const dobInput = document.getElementById("prof-dob");
        const addressInput = document.getElementById("prof-address");

        if (nameInput) nameInput.value = user.name || "";
        if (phoneInput) phoneInput.value = user.phone || "";
        if (emailInput) emailInput.value = user.email || "";
        if (dobInput) dobInput.value = user.dob || "";
        if (addressInput) addressInput.value = user.address || "";

        // Populate Sidebar details
        const sidebarName = document.getElementById("sidebar-user-name");
        const sidebarEmail = document.getElementById("sidebar-user-email");
        const sidebarAvatar = document.getElementById("sidebar-avatar");

        const displayName = (user.title ? `${user.title} ` : '') + (user.name || "Member");
        if (sidebarName) sidebarName.innerText = displayName;
        if (sidebarEmail) sidebarEmail.innerText = user.email || "user@example.com";
        if (sidebarAvatar) sidebarAvatar.innerText = (user.name || "A").charAt(0).toUpperCase();

        // Highlight Title Pill
        if (user.title) {
            document.getElementById("prof-title").value = user.title;
            document.querySelectorAll(".title-pill").forEach(p => {
                if (p.innerText.trim() === user.title.trim()) p.classList.add("selected");
                else p.classList.remove("selected");
            });
        }

        // Highlight Gender Pill
        if (user.gender) {
            document.getElementById("prof-gender").value = user.gender;
            document.querySelectorAll(".gender-pill").forEach(p => {
                if (p.innerText.trim().toLowerCase() === user.gender.trim().toLowerCase()) p.classList.add("selected");
                else p.classList.remove("selected");
            });
        }
    } catch (err) {
        console.warn("Could not load profile details:", err);
    }
}

// Bind Profile Form Submission
function initProfileForm() {
    const form = document.getElementById("profile-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById("save-profile-btn");
        const origBtnText = saveBtn ? saveBtn.innerHTML : "";

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        }

        const payload = {
            title: document.getElementById("prof-title")?.value || "",
            name: document.getElementById("prof-name")?.value.trim() || "",
            phone: document.getElementById("prof-phone")?.value.trim() || "",
            dob: document.getElementById("prof-dob")?.value || "",
            gender: document.getElementById("prof-gender")?.value || "",
            address: document.getElementById("prof-address")?.value.trim() || ""
        };

        try {
            const res = await fetch(`${BASE_URL}/api/auth/profile`, {
                method: "PUT",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast("Profile updated successfully!", "success");
                
                // Update local storage user copy
                try {
                    let localUser = JSON.parse(localStorage.getItem("user") || "{}");
                    localUser = { ...localUser, ...data.user };
                    localStorage.setItem("user", JSON.stringify(localUser));
                } catch (e) {}

                loadProfileDetails();
            } else {
                showToast(data.message || "Could not update profile.", "error");
            }
        } catch (err) {
            showToast("Network error. Please try again.", "error");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = origBtnText;
            }
        }
    });
}

// ==========================================
// 7. INITIALIZATION ON PAGE LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Check initial tab from hash or default to orders
    const initialTab = (window.location.hash || "#orders").replace("#", "");
    switchAccountTab(initialTab);

    initProfileForm();

    // Bind Sidebar Logout
    const logoutBtn = document.getElementById("sidebar-logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.clear();
            localStorage.removeItem("user");
            localStorage.removeItem("userToken");
            localStorage.removeItem("token");
            localStorage.removeItem("userRole");
            window.location.href = "./login.html";
        });
    }
});

window.addEventListener("hashchange", () => {
    const tab = (window.location.hash || "#orders").replace("#", "");
    switchAccountTab(tab);
});