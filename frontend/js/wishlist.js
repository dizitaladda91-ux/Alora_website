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

export function isUserLoggedIn() {
    return Boolean(localStorage.getItem("user") || sessionStorage.getItem("user"));
}
window.isUserLoggedIn = isUserLoggedIn;

export function openWishlistAuthModal() {
    let modal = document.getElementById("wishlist-auth-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "wishlist-auth-modal";
        modal.className = "fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-all duration-300";
        modal.style.cssText = "background-color: rgba(15, 12, 10, 0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);";
        modal.innerHTML = `
            <div style="background-color: #FAF7EE; border: 1.5px solid #E5DEC9; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);" class="rounded-3xl p-6 sm:p-8 max-w-md w-full text-center relative transform transition-all animate-fade-in">
                <!-- Close Button -->
                <button type="button" id="wishlist-modal-close" style="background-color: #EFE8DA; color: #5C4D3C;" class="absolute top-4 right-4 w-9 h-9 rounded-full hover:bg-stone-300 hover:text-stone-900 text-lg font-bold flex items-center justify-center transition shadow-xs cursor-pointer border border-[#DDD4C0]" aria-label="Close">&times;</button>
                
                <!-- Heart Icon Badge with Glow -->
                <div style="background-color: #FFEAEF; border: 1.5px solid #FFCCD7; box-shadow: 0 0 20px rgba(225, 29, 72, 0.18);" class="w-16 h-16 rounded-2xl text-rose-600 mx-auto flex items-center justify-center text-2xl mb-4 transform hover:scale-105 transition-transform duration-300">
                    <i class="fa-solid fa-heart animate-pulse"></i>
                </div>

                <!-- Title & Subtitle -->
                <p style="color: #8B4513; letter-spacing: 0.12em;" class="text-[11px] font-extrabold uppercase mb-1">Alora Beauty Club</p>
                <h3 style="color: #2D241E; font-family: 'Fraunces', Georgia, serif;" class="text-2xl sm:text-[26px] font-bold tracking-tight leading-snug">Save Your Skincare Favorites</h3>
                
                <p style="color: #63564A; line-height: 1.6;" class="text-xs sm:text-sm mt-2.5 mb-6 font-medium">
                    To add and save products to your Wishlist, please log in to your account or create a new account.
                </p>

                <!-- Value Proposition Badges -->
                <div style="background-color: #FFFFFF; border: 1px solid #ECE4CE;" class="rounded-2xl p-3.5 mb-6 text-left space-y-2.5 shadow-2xs">
                    <div class="flex items-center gap-2.5 text-xs text-stone-700 font-medium">
                        <span class="w-5 h-5 rounded-full bg-amber-100 text-[#8B4513] flex items-center justify-center text-[10px] shrink-0 font-bold"><i class="fa-solid fa-check"></i></span>
                        <span>One-click add to cart from your wishlist</span>
                    </div>
                    <div class="flex items-center gap-2.5 text-xs text-stone-700 font-medium">
                        <span class="w-5 h-5 rounded-full bg-amber-100 text-[#8B4513] flex items-center justify-center text-[10px] shrink-0 font-bold"><i class="fa-solid fa-check"></i></span>
                        <span>Access your favorites across phone & desktop</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="space-y-3">
                    <a href="./login.html" style="background-color: #8B4513; color: #FFFFFF; box-shadow: 0 4px 14px rgba(139, 69, 19, 0.3);" class="w-full hover:opacity-95 py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 hover:shadow-lg active:scale-[0.99] cursor-pointer">
                        <i class="fa-solid fa-right-to-bracket text-sm"></i> Login to Your Account
                    </a>
                    <a href="./register.html" style="background-color: #FFFFFF; color: #8B4513; border: 1.5px solid #8B4513;" class="w-full hover:bg-amber-50/60 py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer">
                        <i class="fa-solid fa-user-plus text-sm"></i> Create New Account
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector("#wishlist-modal-close");
        const dismiss = (e) => {
            if (e) e.preventDefault();
            modal.classList.add("opacity-0", "pointer-events-none");
            setTimeout(() => modal.classList.add("hidden"), 300);
        };
        closeBtn.addEventListener("click", dismiss);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) dismiss(e);
        });
    }

    modal.classList.remove("hidden", "opacity-0", "pointer-events-none");
}
window.openWishlistAuthModal = openWishlistAuthModal;

export function handleNavbarWishlistClick(event) {
    if (!isUserLoggedIn()) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        openWishlistAuthModal();
        return false;
    }
    return true;
}
window.handleNavbarWishlistClick = handleNavbarWishlistClick;

export function updateWishlistVisibility(isLoggedIn = null) {
    const logged = isLoggedIn !== null ? isLoggedIn : isUserLoggedIn();
    const allWishBtns = document.querySelectorAll(".wishlist-toggle-btn, #single-wishlist-btn");
    allWishBtns.forEach(btn => {
        btn.classList.remove("hidden");
        btn.style.display = "";
    });

    const badges = document.querySelectorAll("#global-wishlist-badge, #mobile-wishlist-count, #sidebar-wishlist-badge");
    if (!logged) {
        badges.forEach(b => {
            b.classList.add("hidden");
            b.innerText = "0";
        });
    }
}
window.updateWishlistVisibility = updateWishlistVisibility;

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
    if (!isUserLoggedIn()) {
        updateWishlistVisibility(false);
        return;
    }
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
    if (!isUserLoggedIn()) {
        updateWishlistVisibility(false);
        return [];
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

    return [];
}

export async function toggleProductWishlist(productId, btnEl = null) {
    if (!productId) return false;

    // Check if user is logged in
    if (!isUserLoggedIn()) {
        openWishlistAuthModal();
        return false;
    }

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
        } else if (res.status === 401) {
            openWishlistAuthModal();
            return false;
        }
    } catch (err) {
        console.warn("Wishlist toggle API error:", err);
    }

    return false;
}

export async function handleCardWishlistToggle(productId, btnEl, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!btnEl && event?.currentTarget) {
        btnEl = event.currentTarget;
    }
    if (!isUserLoggedIn()) {
        openWishlistAuthModal();
        return false;
    }
    return await toggleProductWishlist(productId, btnEl);
}
window.handleCardWishlistToggle = handleCardWishlistToggle;

export function syncWishlistHeartsOnPage(wishlistItems = null) {
    const logged = isUserLoggedIn();
    updateWishlistVisibility(logged);

    if (!logged) return;

    const list = wishlistItems || [];
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
    const logged = isUserLoggedIn();
    updateWishlistVisibility(logged);
    if (logged) {
        const wishlist = await fetchUserWishlist();
        syncWishlistHeartsOnPage(wishlist);
    }
}

document.addEventListener("DOMContentLoaded", initWishlistOnLoad);
document.addEventListener("partialsLoaded", initWishlistOnLoad);
if (document.readyState === "complete" || document.readyState === "interactive") {
    initWishlistOnLoad();
}
