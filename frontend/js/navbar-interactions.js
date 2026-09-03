import BASE_URL, { getImageUrl, getProductUrl, getAuthHeaders } from './config.js';
import './wishlist.js';

const RUPEE_SYMBOL = '\u20B9';

window.openMobileDrawer = function (event) {
    event?.preventDefault();
    event?.stopPropagation();
    const menu = document.getElementById('mobile-menu');
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!menu || !drawer) return;
    menu.classList.remove('hidden', 'pointer-events-none');
    requestAnimationFrame(() => {
        menu.classList.remove('opacity-0');
        drawer.classList.remove('-translate-x-full');
    });
    document.body.style.overflow = 'hidden';
};

window.closeMobileDrawer = function (event) {
    event?.preventDefault();
    event?.stopPropagation();
    const menu = document.getElementById('mobile-menu');
    const drawer = document.getElementById('mobile-menu-drawer');
    if (!menu || !drawer) return;
    drawer.classList.add('-translate-x-full');
    menu.classList.add('opacity-0', 'pointer-events-none');
    window.setTimeout(() => {
        menu.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
};

document.addEventListener('click', (event) => {
    const mobileMenu = document.getElementById('mobile-menu');
    if (event.target.closest('#menu-btn, .mobile-menu-toggle')) {
        window.openMobileDrawer(event);
        return;
    }
    if (event.target.closest('#menu-close-btn') || event.target === mobileMenu) {
        window.closeMobileDrawer(event);
        return;
    }

    const wishlistNav = event.target.closest('a[href*="wishlist"], a[href*="account.html#wishlist"]');
    if (wishlistNav) {
        const isLogged = Boolean(localStorage.getItem('user') || sessionStorage.getItem('user'));
        if (!isLogged) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof window.openWishlistAuthModal === 'function') {
                window.openWishlistAuthModal();
            } else {
                window.location.href = './login.html';
            }
            return;
        }
    }

    const searchContainer = document.getElementById('search-container');
    if (event.target.closest('#search-open-btn')) {
        event.preventDefault();
        searchContainer?.classList.remove('hidden');
        initSearchFeature();
        document.getElementById('search-input')?.focus();
        return;
    }
    if (event.target.closest('#search-close-btn')) {
        event.preventDefault();
        searchContainer?.classList.add('hidden');
        document.getElementById('search-suggestions')?.classList.add('hidden');
        return;
    }
    const result = event.target.closest('.search-result');
    if (result?.dataset.productUrl) {
        window.location.href = result.dataset.productUrl;
        return;
    }
    if (searchContainer && !searchContainer.contains(event.target)) {
        searchContainer.classList.add('hidden');
        document.getElementById('search-suggestions')?.classList.add('hidden');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        window.closeMobileDrawer(event);
        document.getElementById('search-container')?.classList.add('hidden');
    }
});

document.addEventListener('partialsLoaded', () => {
    initSearchFeature();
    updateCartAndAuthStatus();
    renderNavbarState();
});
document.addEventListener('DOMContentLoaded', () => {
    updateCartAndAuthStatus();
    renderNavbarState();
});
window.addEventListener('load', () => {
    updateCartAndAuthStatus();
    renderNavbarState();
});
document.addEventListener('cartUpdated', updateCartAndAuthStatus);
renderNavbarState();

export async function handleLogout() {
    try {
        await fetch(`${BASE_URL}/api/auth/logout`, { 
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include" 
        });
    } catch (err) {
        console.error("Logout API error:", err);
    } finally {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("userRole");
        localStorage.removeItem("token");
        localStorage.removeItem("tabAuthActive");
        window.location.replace("./login.html");
    }
}
window.handleLogout = handleLogout;

export function renderNavbarState() {
    const storedUserStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    
    const updateUI = (authContainer) => {
        if (!storedUserStr) {
            authContainer.innerHTML = `
                <a href="./login.html" aria-label="User Account Login" title="User Account Login" class="text-base text-black hover:text-gold transition">
                    <i class="fa-solid fa-user" aria-hidden="true"></i>
                    <span class="sr-only">User Account Login</span>
                </a>
            `;
            return;
        }

        try {
            const user = JSON.parse(storedUserStr);
            const role = user.role || sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
            if (role === "admin" || role === "seoadmin") {
                authContainer.innerHTML = `
                    <a href="${role === 'admin' ? './admin.html' : './seoadmin.html'}" aria-label="Admin Portal" title="Admin Portal" class="text-base text-black hover:text-gold transition">
                        <i class="fa-solid fa-user" aria-hidden="true"></i>
                        <span class="sr-only">Admin Portal</span>
                    </a>
                `;
            } else {
                const userName = user.name || user.username || (user.email ? user.email.split('@')[0] : "User");
                authContainer.innerHTML = `
                    <!-- Desktop View: Full Controls -->
                    <div class="hidden md:flex items-center gap-2.5 text-sm font-medium text-black normal-case">
                        <a href="./account.html" class="hover:text-[#A0522D] transition flex items-center gap-1">
                            <span class="whitespace-nowrap">Hi, <b class="text-[#2A2A24] font-bold uppercase">${userName}</b></span>
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
                        <a href="./account.html" class="relative text-[#152219] hover:text-[#8B4513] transition p-1.5 flex items-center justify-center rounded-full bg-amber-50 border border-amber-200/80 shadow-2xs" title="My Account (${userName})">
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
                                    ${userName.charAt(0)}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-slate-900 truncate">Hi, ${userName}</p>
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

                document.querySelectorAll('.logout-btn-trigger').forEach((btn) => {
                    if (!btn.dataset.bound) {
                        btn.dataset.bound = "true";
                        btn.addEventListener("click", (e) => {
                            e.preventDefault();
                            handleLogout();
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Error parsing user from storage:", err);
            localStorage.removeItem("user");
        }
    };

    const checkAndRender = () => {
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
        if (authActions) {
            updateUI(authActions);
            return true;
        }
        return false;
    };

    if (checkAndRender()) return;
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (checkAndRender() || attempts > 30) {
            clearInterval(interval);
        }
    }, 100);
}
window.renderNavbarState = renderNavbarState;

function initSearchFeature() {
    const input = document.getElementById('search-input');
    const suggestions = document.getElementById('search-suggestions');
    if (!input || !suggestions || input.dataset.searchInitialized === 'true') return;
    input.dataset.searchInitialized = 'true';

    let debounceTimer;
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && input.value.trim()) {
            window.location.href = `/products?search=${encodeURIComponent(input.value.trim())}`;
        }
    });
    input.addEventListener('input', () => {
        const query = input.value.trim();
        window.clearTimeout(debounceTimer);
        if (query.length < 2) {
            suggestions.classList.add('hidden');
            return;
        }
        debounceTimer = window.setTimeout(() => searchProducts(query, suggestions), 300);
    });
}

async function searchProducts(query, suggestions) {
    try {
        let products = [];
        const response = await fetch(`${BASE_URL}/api/product/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            products = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
        }
        if (!products.length) {
            const allResponse = await fetch(`${BASE_URL}/api/product/all`);
            if (allResponse.ok) {
                const allProducts = await allResponse.json();
                const normalizedQuery = query.toLowerCase();
                products = (Array.isArray(allProducts) ? allProducts : []).filter((product) =>
                    [product.name, product.title, product.category, product.description]
                        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
                );
            }
        }
        suggestions.innerHTML = products.length
            ? products.map(renderSearchResult).join('')
            : '<p class="p-4 text-xs text-stone-500 text-center font-medium">No products found.</p>';
        suggestions.classList.remove('hidden');
    } catch (error) {
        console.error('Product search failed:', error);
    }
}

function renderSearchResult(product) {
    const name = product.name || product.title || 'Product';
    const image = getImageUrl(product.imagepath, '/static/placeholder.png');
    const price = product.variants?.[0]?.price ?? product.price ?? product.discountprice ?? product.productPrice;
    const displayPrice = price == null ? '' : `<span class="block text-[11px] text-[#A0522D] font-bold">${RUPEE_SYMBOL} ${String(price).replace(/[^\d.]/g, '')}</span>`;
    return `<button type="button" data-product-url="${getProductUrl(product)}" class="search-result flex w-full items-center gap-3 p-3 hover:bg-stone-50 border-b border-stone-100 last:border-b-0 transition text-left">
        <img src="${image}" alt="${name}" class="w-10 h-10 object-contain rounded bg-stone-50 border border-stone-200">
        <span class="flex-1 min-w-0"><span class="block text-xs font-semibold text-black truncate">${name}</span>${displayPrice}</span>
        <i class="fa-solid fa-chevron-right text-[10px] text-stone-400 pr-1"></i>
    </button>`;
}

function updateCartAndAuthStatus() {
    let cartCount = 0;
    try {
        const cart = JSON.parse(localStorage.getItem('glowCart') || localStorage.getItem('glowRitualCartData') || '[]');
        if (Array.isArray(cart)) cartCount = cart.reduce((total, item) => total + (Number(item.qty || item.qtyCountOrderMetric) || 0), 0);
    } catch (error) {
        console.warn('Error computing cart count for navbar:', error);
    }
    document.querySelectorAll('#global-cart-badge, .cart-badge, #cart-count').forEach((badge) => {
        badge.textContent = String(cartCount);
    });
    renderNavbarState();
}
