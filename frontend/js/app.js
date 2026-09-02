import BASE_URL, { getImageUrl, getProductUrl } from "./config.js";
const RUPEE_SYMBOL = "₹";
export function showSuccessModal(title, message, callback) {
    const existingModal = document.getElementById("custom-success-modal");
    if (existingModal) existingModal.remove();
    const modal = document.createElement("div");
    modal.id = "custom-success-modal";
    modal.className = "fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300";
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-gray-100 transform scale-100 animate-in fade-in zoom-in duration-200">
            <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                <i class="fa-solid fa-check"></i>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">${title}</h3>
            <p class="text-gray-500 text-sm mb-6">${message}</p>
            <button id="modal-ok-btn" class="w-full bg-[#2A2A24] hover:bg-amber-800 text-white font-semibold py-2.5 rounded-xl transition shadow-md focus:outline-none">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("modal-ok-btn").addEventListener("click", () => {
        modal.remove();
        if (callback) callback();
    });
}
export function renderNavbarState() {
    let authActions = document.getElementById("auth-actions");
    if (!authActions) {
        const navAuthContainer = document.getElementById("nav-auth-container");
        if (navAuthContainer) {
            authActions = navAuthContainer.querySelector('#auth-actions');
            if (!authActions) {
                authActions = document.createElement('div');
                authActions.id = 'auth-actions';
                authActions.className = 'flex items-center gap-4';
                navAuthContainer.appendChild(authActions);
            }
        }
    }
    if (!authActions) return;

    const storedUserStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    
    if (!storedUserStr) {
        authActions.innerHTML = `
            <a href="./login.html" aria-label="User Account Login" title="User Account Login" class="text-base text-black hover:text-gold transition">
                <i class="fa-solid fa-user" aria-hidden="true"></i>
                <span class="sr-only">User Account Login</span>
            </a>
        `;
        return;
    }
    try {
        const user = storedUserStr ? JSON.parse(storedUserStr) : {};
        const role = user.role || sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
        if (role === "admin" || role === "seoadmin") {
            authActions.innerHTML = `
                <a href="${role === 'admin' ? './admin.html' : './seoadmin.html'}" aria-label="Admin Portal" title="Admin Portal" class="text-base text-black hover:text-gold transition">
                    <i class="fa-solid fa-user" aria-hidden="true"></i>
                    <span class="sr-only">Admin Portal</span>
                </a>
            `;
        } else {
            const displayName = user.name || user.username || (user.email ? user.email.split('@')[0] : "User");
            authActions.innerHTML = `
                <!-- Desktop View: Full Controls -->
                <div class="hidden md:flex items-center gap-2.5 text-sm font-medium text-black normal-case">
                    <a href="./account.html" class="hover:text-[#A0522D] transition flex items-center gap-1">
                        <span class="whitespace-nowrap">Hi, <b class="text-[#2A2A24] font-bold uppercase">${displayName}</b></span>
                    </a>
                    <a href="./account.html" class="bg-amber-100 hover:bg-amber-200 text-[#8B4513] text-[11px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-extrabold shadow-xs flex items-center gap-1.5 border border-amber-300">
                        <i class="fa-solid fa-user-circle text-xs"></i> My Account
                    </a>
                    <button type="button" class="logout-btn-trigger bg-black hover:bg-orange-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-bold shadow-sm cursor-pointer">
                        Logout
                    </button>
                </div>
                <!-- Mobile View: Compact Sleek User Profile Icon -->
                <div class="flex md:hidden items-center">
                    <a href="./account.html" class="relative text-[#152219] hover:text-[#8B4513] transition p-1.5 flex items-center justify-center rounded-full bg-amber-50 border border-amber-200/80 shadow-2xs" title="My Account (${displayName})">
                        <i class="fa-solid fa-user text-sm text-[#8B4513]"></i>
                        <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
                    </a>
                </div>
            `;
            // Also update Mobile Drawer Auth Section if present
            const mobileDrawerAuth = document.querySelector('#mobile-menu-drawer .pt-6.border-t');
            if (mobileDrawerAuth) {
                mobileDrawerAuth.innerHTML = `
                    <div class="p-3 bg-amber-50/90 rounded-2xl border border-amber-200/80 shadow-2xs mb-1">
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-8 h-8 rounded-full bg-[#8B4513] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                ${displayName.charAt(0)}
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-xs font-bold text-slate-900 truncate">Hi, ${displayName}</p>
                                <p class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Logged In
                                </p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <a href="./account.html" class="bg-amber-100 hover:bg-amber-200 text-[#8B4513] text-[11px] py-1.5 px-2 rounded-lg text-center font-bold flex items-center justify-center gap-1 border border-amber-300">
                                <i class="fa-solid fa-user-circle text-[10px]"></i> My Account
                            </a>
                            <button type="button" class="logout-btn-trigger bg-slate-900 text-white text-[11px] py-1.5 px-2 rounded-lg text-center font-bold cursor-pointer">
                                Logout
                            </button>
                        </div>
                    </div>
                `;
            }
            const bindLogout = () => {
                sessionStorage.clear();
                localStorage.removeItem("token");
                localStorage.removeItem("userToken");
                localStorage.removeItem("user");
                localStorage.removeItem("userRole");
                window.location.href = "./index.html";
            };
            document.querySelectorAll('.logout-btn-trigger').forEach((btn) => {
                if (!btn.dataset.bound) {
                    btn.dataset.bound = "true";
                    btn.addEventListener("click", bindLogout);
                }
            });
        }
    } catch (e) {
        console.error("User storage parse error:", e);
    }
}
function initSearchFunctionality() {
    const searchOpenBtn = document.getElementById("search-open-btn");
    const searchCloseBtn = document.getElementById("search-close-btn");
    const searchContainer = document.getElementById("search-container");
    const searchInput = document.getElementById("search-input");
    const suggestionsBox = document.getElementById("search-suggestions");
    if (!searchOpenBtn || !searchContainer || !searchInput || !suggestionsBox) {
        return;
    }
    if (searchInput.dataset.appSearchInitialized === 'true') return;
    searchInput.dataset.appSearchInitialized = 'true';
    let debounceTimer;
    searchOpenBtn.addEventListener("click", () => {
        searchContainer.classList.remove("hidden");
        searchInput.focus();
    });
    searchCloseBtn.addEventListener("click", () => {
        searchContainer.classList.add("hidden");
        suggestionsBox.classList.add("hidden");
        searchInput.value = "";
    });
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        if (query.length < 2) {
            suggestionsBox.innerHTML = "";
            suggestionsBox.classList.add("hidden");
            return;
        }
        debounceTimer = setTimeout(() => {
            fetchSearchSuggestions(query, suggestionsBox);
        }, 300);
    });
    document.addEventListener("click", (e) => {
        if (!searchContainer.contains(e.target) && !searchOpenBtn.contains(e.target)) {
            searchContainer.classList.add("hidden");
            suggestionsBox.classList.add("hidden");
        }
    });
}
async function fetchSearchSuggestions(query, suggestionsBox) {
    try {
        const response = await fetch(`${BASE_URL}/api/product?search=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = await response.json();
        const productsList = data.products || (Array.isArray(data) ? data : []);
        if (productsList.length === 0) {
            suggestionsBox.innerHTML = `<div class="p-4 text-xs text-stone-500 text-center font-medium">No products found for "<i>${query}</i>"</div>`;
            suggestionsBox.classList.remove("hidden");
            return;
        }
        suggestionsBox.innerHTML = productsList.map(prod => {
            const imageSrc = getImageUrl(prod.imagepath, '/static/placeholder.png');
            const rawPrice = (prod.variants && prod.variants.length > 0 && prod.variants[0] && prod.variants[0].price != null)
                ? prod.variants[0].price
                : (prod.price ?? prod.discountprice ?? prod.productPrice ?? 'N/A');
            const cleanedPrice = (rawPrice === 'N/A' || rawPrice == null) ? '' : String(rawPrice).replace(/[^\d.]/g, '').trim();
            const displayPrice = cleanedPrice ? `${RUPEE_SYMBOL} ${cleanedPrice}` : '';
            return `
                <div onclick="window.location.href='${getProductUrl(prod)}'" class="flex items-center gap-3 p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0 transition text-left">
                    <img src="${imageSrc}" alt="${prod.name || 'Product'}" class="w-10 h-10 object-contain rounded bg-stone-50 border border-stone-200" onerror="this.src='/static/placeholder.png'">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-black truncate text-left">${prod.name || prod.title || ''}</p>
                        ${displayPrice ? `<p class="text-[11px] text-[#A0522D] font-bold text-left" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Symbol', sans-serif;">${displayPrice}</p>` : ''}
                    </div>
                    <i class="fa-solid fa-chevron-right text-[10px] text-stone-400 pr-1"></i>
                </div>
            `;
        }).join("");
        suggestionsBox.classList.remove("hidden");
    } catch (error) {
        console.error("Search API Error:", error);
    }
}
function setupAppLifecycle() {
    renderNavbarState();
    initSearchFunctionality();
}
document.addEventListener("DOMContentLoaded", setupAppLifecycle);
document.addEventListener("partialsLoaded", setupAppLifecycle);