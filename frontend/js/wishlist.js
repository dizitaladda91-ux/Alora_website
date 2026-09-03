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

let pendingWishlistProduct = null;

export function closeWishlistAuthModal() {
    const modal = document.getElementById("wishlist-auth-modal");
    if (modal) {
        modal.classList.add("opacity-0", "pointer-events-none");
        setTimeout(() => modal.classList.add("hidden"), 250);
    }
}
window.closeWishlistAuthModal = closeWishlistAuthModal;

export function openWishlistAuthModal(productId = null, btnEl = null) {
    if (productId) {
        pendingWishlistProduct = { productId, btnEl };
    }

    let modal = document.getElementById("wishlist-auth-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "wishlist-auth-modal";
        modal.className = "fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 transition-all duration-300";
        modal.style.cssText = "background-color: rgba(15, 12, 10, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);";
        modal.innerHTML = `
            <div style="background-color: #FAF7EE; border: 1.5px solid #E5DEC9; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);" class="rounded-3xl p-5 sm:p-7 max-w-md w-full text-center relative transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto">
                <!-- Close Button -->
                <button type="button" id="wishlist-modal-close" style="background-color: #EFE8DA; color: #5C4D3C;" class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full hover:bg-stone-300 hover:text-stone-900 text-base font-bold flex items-center justify-center transition shadow-xs cursor-pointer border border-[#DDD4C0]" aria-label="Close">&times;</button>
                
                <!-- Heart Icon Badge with Glow -->
                <div style="background-color: #FFEAEF; border: 1.5px solid #FFCCD7; box-shadow: 0 0 18px rgba(225, 29, 72, 0.18);" class="w-12 h-12 rounded-2xl text-rose-600 mx-auto flex items-center justify-center text-xl mb-3 transform hover:scale-105 transition-transform duration-300">
                    <i class="fa-solid fa-heart animate-pulse"></i>
                </div>

                <!-- Title & Subtitle -->
                <p style="color: #8B4513; letter-spacing: 0.12em;" class="text-[10px] font-extrabold uppercase mb-0.5">Alora Beauty Club</p>
                <h3 style="color: #2D241E; font-family: 'Fraunces', Georgia, serif;" class="text-xl sm:text-2xl font-bold tracking-tight leading-snug">Save to Your Wishlist</h3>
                <p style="color: #63564A; line-height: 1.5;" class="text-xs mt-1 mb-4 font-medium">
                    Create an account to save your favorite skincare products and access them anytime.
                </p>

                <!-- Auth Mode Switcher Tabs -->
                <div class="flex items-center justify-center p-1 bg-stone-200/60 rounded-2xl mb-4 border border-stone-300/40 text-xs font-bold">
                    <button type="button" id="wmodal-tab-register" class="flex-1 py-2 rounded-xl transition-all duration-200 bg-white text-[#8B4513] shadow-xs cursor-pointer">
                        <i class="fa-solid fa-user-plus text-[11px] mr-1"></i> Create Account
                    </button>
                    <button type="button" id="wmodal-tab-login" class="flex-1 py-2 rounded-xl transition-all duration-200 text-stone-600 hover:text-stone-900 cursor-pointer">
                        <i class="fa-solid fa-right-to-bracket text-[11px] mr-1"></i> Sign In
                    </button>
                </div>

                <!-- 1. REGISTER FORM -->
                <form id="wmodal-register-form" class="space-y-2.5 text-left">
                    <div>
                        <input type="text" id="wmodal-reg-name" required placeholder="Full Name" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>
                    <div>
                        <input type="email" id="wmodal-reg-email" required placeholder="Email Address" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>
                    <div>
                        <input type="tel" id="wmodal-reg-phone" required placeholder="Phone Number (10 digits)" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>
                    <div>
                        <input type="password" id="wmodal-reg-password" required minlength="6" placeholder="Create Password (min 6 chars)" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>
                    
                    <div id="wmodal-reg-error" class="hidden text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 p-2 rounded-xl text-center"></div>

                    <button type="submit" id="wmodal-reg-submit" style="background-color: #8B4513; color: #FFFFFF; box-shadow: 0 4px 14px rgba(139, 69, 19, 0.25);" class="w-full hover:opacity-95 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.99] cursor-pointer mt-2">
                        <i class="fa-solid fa-heart text-rose-300 text-xs"></i> Create Account &amp; Save Product
                    </button>
                </form>

                <!-- 2. LOGIN FORM -->
                <form id="wmodal-login-form" class="hidden space-y-2.5 text-left">
                    <div>
                        <input type="email" id="wmodal-login-email" required placeholder="Email Address" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>
                    <div>
                        <input type="password" id="wmodal-login-password" required placeholder="Password" class="w-full bg-white text-stone-900 placeholder-stone-400 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#8B4513] border border-[#DDD4C0] shadow-2xs">
                    </div>

                    <div id="wmodal-login-error" class="hidden text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 p-2 rounded-xl text-center"></div>

                    <button type="submit" id="wmodal-login-submit" style="background-color: #8B4513; color: #FFFFFF; box-shadow: 0 4px 14px rgba(139, 69, 19, 0.25);" class="w-full hover:opacity-95 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.99] cursor-pointer mt-2">
                        <i class="fa-solid fa-right-to-bracket text-xs"></i> Sign In &amp; Save Product
                    </button>
                </form>

                <!-- Privacy note -->
                <p class="text-[10px] text-stone-400 mt-3.5">
                    Your details are safe and protected with Alora Radiance.
                </p>
            </div>
        `;
        document.body.appendChild(modal);

        // Tab Switching Logic
        const tabReg = modal.querySelector("#wmodal-tab-register");
        const tabLogin = modal.querySelector("#wmodal-tab-login");
        const formReg = modal.querySelector("#wmodal-register-form");
        const formLogin = modal.querySelector("#wmodal-login-form");
        const regErr = modal.querySelector("#wmodal-reg-error");
        const loginErr = modal.querySelector("#wmodal-login-error");

        tabReg.addEventListener("click", () => {
            tabReg.className = "flex-1 py-2 rounded-xl transition-all duration-200 bg-white text-[#8B4513] shadow-xs cursor-pointer";
            tabLogin.className = "flex-1 py-2 rounded-xl transition-all duration-200 text-stone-600 hover:text-stone-900 cursor-pointer";
            formReg.classList.remove("hidden");
            formLogin.classList.add("hidden");
            regErr.classList.add("hidden");
        });

        tabLogin.addEventListener("click", () => {
            tabLogin.className = "flex-1 py-2 rounded-xl transition-all duration-200 bg-white text-[#8B4513] shadow-xs cursor-pointer";
            tabReg.className = "flex-1 py-2 rounded-xl transition-all duration-200 text-stone-600 hover:text-stone-900 cursor-pointer";
            formLogin.classList.remove("hidden");
            formReg.classList.add("hidden");
            loginErr.classList.add("hidden");
        });

        // Register Submit Handler
        formReg.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = modal.querySelector("#wmodal-reg-name").value.trim();
            const email = modal.querySelector("#wmodal-reg-email").value.trim();
            const phone = modal.querySelector("#wmodal-reg-phone").value.trim();
            const password = modal.querySelector("#wmodal-reg-password").value;
            const submitBtn = modal.querySelector("#wmodal-reg-submit");

            regErr.classList.add("hidden");
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Creating Account...`;

            try {
                const res = await fetch(`${BASE_URL}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, phone, password }),
                    credentials: "include"
                });
                const data = await res.json();
                if (res.ok) {
                    if (data.token) {
                        localStorage.setItem("token", data.token);
                        sessionStorage.setItem("token", data.token);
                    }
                    const userData = data.user || {};
                    localStorage.setItem("user", JSON.stringify(userData));
                    sessionStorage.setItem("user", JSON.stringify(userData));
                    localStorage.setItem("userRole", userData.role || "user");

                    closeWishlistAuthModal();
                    updateWishlistVisibility(true);

                    if (pendingWishlistProduct?.productId) {
                        const targetId = pendingWishlistProduct.productId;
                        const targetBtn = pendingWishlistProduct.btnEl;
                        pendingWishlistProduct = null;
                        await toggleProductWishlist(targetId, targetBtn);
                    } else {
                        notifyWishlist(`Welcome ${userData.name || ''}! Account created successfully.`, "success");
                    }
                } else {
                    regErr.innerText = data.message || "Registration failed. Please check your details.";
                    regErr.classList.remove("hidden");
                }
            } catch (err) {
                regErr.innerText = "Network error. Please try again.";
                regErr.classList.remove("hidden");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-heart text-rose-300 text-xs"></i> Create Account &amp; Save Product`;
            }
        });

        // Login Submit Handler
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = modal.querySelector("#wmodal-login-email").value.trim();
            const password = modal.querySelector("#wmodal-login-password").value;
            const submitBtn = modal.querySelector("#wmodal-login-submit");

            loginErr.classList.add("hidden");
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Signing In...`;

            try {
                const res = await fetch(`${BASE_URL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                    credentials: "include"
                });
                const data = await res.json();
                if (res.ok && data.success !== false) {
                    if (data.token) {
                        localStorage.setItem("token", data.token);
                        sessionStorage.setItem("token", data.token);
                    }
                    const userData = data.user || data.data || {};
                    localStorage.setItem("user", JSON.stringify(userData));
                    sessionStorage.setItem("user", JSON.stringify(userData));
                    localStorage.setItem("userRole", userData.role || "user");

                    closeWishlistAuthModal();
                    updateWishlistVisibility(true);

                    if (pendingWishlistProduct?.productId) {
                        const targetId = pendingWishlistProduct.productId;
                        const targetBtn = pendingWishlistProduct.btnEl;
                        pendingWishlistProduct = null;
                        await toggleProductWishlist(targetId, targetBtn);
                    } else {
                        notifyWishlist(`Welcome back, ${userData.name || ''}!`, "success");
                    }
                } else {
                    loginErr.innerText = data.message || "Invalid Email or Password.";
                    loginErr.classList.remove("hidden");
                }
            } catch (err) {
                loginErr.innerText = "Network error. Please try again.";
                loginErr.classList.remove("hidden");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket text-xs"></i> Sign In &amp; Save Product`;
            }
        });

        const closeBtn = modal.querySelector("#wishlist-modal-close");
        closeBtn.addEventListener("click", () => closeWishlistAuthModal());
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeWishlistAuthModal();
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
        openWishlistAuthModal(productId, btnEl);
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
            openWishlistAuthModal(productId, btnEl);
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
        openWishlistAuthModal(productId, btnEl);
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
