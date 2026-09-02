import BASE_URL, { getAuthHeaders } from "./config.js";

const LOCAL_WISHLIST_KEY = "alora_wishlist_local";

// Inject animation styles once
function injectWishlistStyles() {
    if (document.getElementById("alora-wishlist-anim-styles")) return;
    const style = document.createElement("style");
    style.id = "alora-wishlist-anim-styles";
    style.textContent = `
        @keyframes alora-heart-pop {
            0% { transform: scale(1); }
            20% { transform: scale(1.45) rotate(-10deg); }
            45% { transform: scale(0.85) rotate(6deg); }
            70% { transform: scale(1.2) rotate(-3deg); }
            100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes alora-badge-bounce {
            0% { transform: scale(1); }
            35% { transform: scale(1.45); }
            65% { transform: scale(0.9); }
            100% { transform: scale(1); }
        }
        @keyframes alora-sparkle-burst {
            0% {
                opacity: 1;
                transform: translate(0, 0) scale(0.5);
            }
            100% {
                opacity: 0;
                transform: translate(var(--dx), var(--dy)) scale(1.3);
            }
        }
        .wishlist-heart-pop {
            animation: alora-heart-pop 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important;
        }
        .wishlist-badge-pulse {
            animation: alora-badge-bounce 0.5s ease-out forwards !important;
        }
        .wishlist-btn-glow {
            box-shadow: 0 0 15px rgba(225, 29, 72, 0.45) !important;
            transition: box-shadow 0.4s ease-out;
        }
    `;
    document.head.appendChild(style);
}

export function getLocalWishlist() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_WISHLIST_KEY) || "[]");
    } catch {
        return [];
    }
}

export function saveLocalWishlist(list) {
    try {
        localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn("Could not persist local wishlist", e);
    }
}

export function updateWishlistBadge(count) {
    const badges = document.querySelectorAll("#global-wishlist-badge, #mobile-wishlist-count, #sidebar-wishlist-badge, .wishlist-badge");
    badges.forEach(badge => {
        if (badge) {
            badge.innerText = count || "0";
            if (count > 0) {
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        }
    });
}

function notifyWishlist(message, type = "success") {
    if (typeof window.showToast === "function") {
        window.showToast(message, type);
    } else if (typeof window.showToastNotification === "function") {
        window.showToastNotification(message, type);
    }
}

// Particle Sparkle Burst effect around the clicked heart
function triggerSparkleBurst(btnEl) {
    if (!btnEl) return;
    const rect = btnEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const particlesCount = 7;
    for (let i = 0; i < particlesCount; i++) {
        const p = document.createElement("span");
        p.className = "fixed z-[10000] pointer-events-none rounded-full select-none";
        
        const angle = (i * (360 / particlesCount) + (Math.random() * 20 - 10)) * (Math.PI / 180);
        const distance = 26 + Math.random() * 22;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const size = Math.random() > 0.5 ? 6 : 4;
        
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${centerX}px`;
        p.style.top = `${centerY}px`;
        p.style.backgroundColor = i % 2 === 0 ? "#e11d48" : "#fb7185";
        p.style.setProperty("--dx", `${dx}px`);
        p.style.setProperty("--dy", `${dy}px`);
        p.style.animation = "alora-sparkle-burst 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards";
        
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
    }
}

// Flying Heart animation from button to Navbar Wishlist Icon
function flyHeartToNavbar(btnEl) {
    if (!btnEl) return;
    const startRect = btnEl.getBoundingClientRect();
    const targetEl = document.getElementById("global-wishlist-badge") || document.querySelector('a[href*="wishlist"] i') || document.querySelector('a[href*="wishlist"]');
    if (!targetEl) return;

    const targetRect = targetEl.getBoundingClientRect();

    const flyer = document.createElement("div");
    flyer.innerHTML = `<i class="fa-solid fa-heart text-rose-500 drop-shadow-md"></i>`;
    flyer.className = "fixed z-[10001] pointer-events-none text-base sm:text-lg select-none transition-all duration-700 ease-in-out";
    flyer.style.left = `${startRect.left + startRect.width / 2 - 8}px`;
    flyer.style.top = `${startRect.top + startRect.height / 2 - 8}px`;
    flyer.style.opacity = "1";
    flyer.style.transform = "scale(1.35)";
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left + targetRect.width / 2 - 8}px`;
            flyer.style.top = `${targetRect.top + targetRect.height / 2 - 8}px`;
            flyer.style.transform = "scale(0.35) rotate(18deg)";
            flyer.style.opacity = "0.75";
        });
    });

    setTimeout(() => {
        flyer.remove();
        pulseNavbarWishlistBadge();
    }, 700);
}

function pulseNavbarWishlistBadge() {
    const badges = document.querySelectorAll("#global-wishlist-badge, #mobile-wishlist-count, #sidebar-wishlist-badge");
    badges.forEach(b => {
        b.classList.add("wishlist-badge-pulse");
        setTimeout(() => b.classList.remove("wishlist-badge-pulse"), 550);
    });
    const headerIcons = document.querySelectorAll('a[href*="wishlist"] i');
    headerIcons.forEach(icon => {
        icon.classList.add("wishlist-heart-pop");
        setTimeout(() => icon.classList.remove("wishlist-heart-pop"), 550);
    });
}

function updateHeartUI(btnEl, isAdded, triggerAnimation = false) {
    if (!btnEl) return;
    injectWishlistStyles();

    const icon = btnEl.querySelector("i") || btnEl;
    if (isAdded) {
        icon.classList.remove("fa-regular", "text-stone-400", "text-slate-400");
        icon.classList.add("fa-solid", "text-rose-600");
        btnEl.classList.add("bg-rose-50", "border-rose-200");

        if (triggerAnimation) {
            icon.classList.remove("wishlist-heart-pop");
            void icon.offsetWidth; // trigger reflow
            icon.classList.add("wishlist-heart-pop");

            btnEl.classList.add("wishlist-btn-glow");
            setTimeout(() => btnEl.classList.remove("wishlist-btn-glow"), 600);

            triggerSparkleBurst(btnEl);
            flyHeartToNavbar(btnEl);
        }
    } else {
        icon.classList.remove("fa-solid", "text-rose-600");
        icon.classList.add("fa-regular", "text-stone-400");
        btnEl.classList.remove("bg-rose-50", "border-rose-200", "wishlist-btn-glow");

        if (triggerAnimation) {
            icon.classList.remove("wishlist-heart-pop");
            void icon.offsetWidth;
            icon.classList.add("wishlist-heart-pop");
        }
    }
}

export async function fetchUserWishlist() {
    const isLogged = Boolean(localStorage.getItem("user") || sessionStorage.getItem("user"));
    if (!isLogged) {
        const local = getLocalWishlist();
        updateWishlistBadge(local.length);
        return local;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });
        if (res.ok) {
            const data = await res.json();
            const list = data.data || [];
            updateWishlistBadge(list.length);
            return list;
        }
    } catch (err) {
        console.warn("Could not fetch remote wishlist:", err);
    }

    const local = getLocalWishlist();
    updateWishlistBadge(local.length);
    return local;
}

export async function toggleProductWishlist(productId, btnEl = null) {
    if (!productId) return;
    const isLogged = Boolean(localStorage.getItem("user") || sessionStorage.getItem("user"));

    if (isLogged) {
        try {
            const res = await fetch(`${BASE_URL}/api/wishlist/toggle`, {
                method: "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({ productId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                updateWishlistBadge(data.wishlistCount);
                if (btnEl) {
                    updateHeartUI(btnEl, data.isAdded, true);
                }
                notifyWishlist(data.isAdded ? "Added to your Wishlist ❤️" : "Removed from your Wishlist.", data.isAdded ? "success" : "info");
                return data.isAdded;
            }
        } catch (err) {
            console.warn("Wishlist toggle API error:", err);
        }
    }

    // Guest / LocalStorage fallback
    let local = getLocalWishlist();
    const stringId = String(productId);
    const idx = local.findIndex(item => (typeof item === "string" ? item === stringId : String(item._id || item.id) === stringId));
    let isAdded = false;

    if (idx > -1) {
        local.splice(idx, 1);
        isAdded = false;
    } else {
        local.push(productId);
        isAdded = true;
    }

    saveLocalWishlist(local);
    updateWishlistBadge(local.length);
    if (btnEl) {
        updateHeartUI(btnEl, isAdded, true);
    }
    notifyWishlist(isAdded ? "Added to your Wishlist ❤️" : "Removed from your Wishlist.", isAdded ? "success" : "info");
    return isAdded;
}

export async function handleCardWishlistToggle(productId, btnEl, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!btnEl && event?.currentTarget) {
        btnEl = event.currentTarget;
    }
    return await toggleProductWishlist(productId, btnEl);
}
window.handleCardWishlistToggle = handleCardWishlistToggle;

export function syncWishlistHeartsOnPage(wishlistItems = null) {
    const list = wishlistItems || getLocalWishlist();
    const productIds = new Set(list.map(item => typeof item === "string" ? item : String(item._id || item.id || "")));
    
    document.querySelectorAll("[data-product-id]").forEach(card => {
        const prodId = card.getAttribute("data-product-id");
        const btn = card.querySelector(".wishlist-toggle-btn");
        if (btn && prodId) {
            updateHeartUI(btn, productIds.has(String(prodId)), false);
        }
    });

    const singleBtn = document.getElementById("single-wishlist-btn");
    if (singleBtn) {
        const urlParams = new URLSearchParams(window.location.search);
        const pathMatch = window.location.pathname.match(/^\/product\/([^/?#]+)\/?$/i);
        const productId = pathMatch ? decodeURIComponent(pathMatch[1]) : urlParams.get('id');
        if (productId) {
            updateHeartUI(singleBtn, productIds.has(String(productId)), false);
        }
    }
}
window.syncWishlistHeartsOnPage = syncWishlistHeartsOnPage;
window.toggleProductWishlist = toggleProductWishlist;

// Global Delegated Click Listener with Capture phase
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".wishlist-toggle-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    if (btn._isToggling) return;
    btn._isToggling = true;

    try {
        let prodId = btn.dataset.productId;
        if (!prodId) {
            const card = btn.closest("[data-product-id]");
            if (card) {
                prodId = card.getAttribute("data-product-id");
            }
        }
        if (!prodId && btn.id === "single-wishlist-btn") {
            const urlParams = new URLSearchParams(window.location.search);
            const pathMatch = window.location.pathname.match(/^\/product\/([^/?#]+)\/?$/i);
            prodId = pathMatch ? decodeURIComponent(pathMatch[1]) : urlParams.get('id');
        }

        if (prodId) {
            await toggleProductWishlist(prodId, btn);
        }
    } catch (err) {
        console.warn("Wishlist click error:", err);
    } finally {
        setTimeout(() => {
            btn._isToggling = false;
        }, 400);
    }
}, true);

async function initWishlistOnLoad() {
    injectWishlistStyles();
    const wishlist = await fetchUserWishlist();
    syncWishlistHeartsOnPage(wishlist);
}

document.addEventListener("DOMContentLoaded", initWishlistOnLoad);
document.addEventListener("partialsLoaded", initWishlistOnLoad);
if (document.readyState === "complete" || document.readyState === "interactive") {
    initWishlistOnLoad();
}
