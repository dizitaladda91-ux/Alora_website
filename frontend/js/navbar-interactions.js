// js/navbar-interactions.js
import BASE_URL, { getImageUrl, getProductUrl } from './config.js';
const RUPEE_SYMBOL = '\u20B9';

// Global Event Delegation for Mobile Menu
document.addEventListener('click', (e) => {
    // 1. Mobile Menu Open Button Click
    const menuBtn = e.target.closest('#menu-btn');
    if (menuBtn) {
        const mobileMenu = document.getElementById('mobile-menu');
        const drawer = document.getElementById('mobile-menu-drawer');
        if (mobileMenu && drawer) {
            mobileMenu.classList.remove('hidden', 'pointer-events-none');
            requestAnimationFrame(() => {
                mobileMenu.classList.remove('opacity-0');
                drawer.classList.remove('-translate-x-full');
            });
            document.body.style.overflow = 'hidden';
        }
        return;
    }

    // 2. Mobile Menu Close Button Click
    const menuCloseBtn = e.target.closest('#menu-close-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const drawer = document.getElementById('mobile-menu-drawer');

    if (menuCloseBtn && mobileMenu && drawer) {
        closeMobileDrawer(mobileMenu, drawer);
        return;
    }

    // 3. Close when clicking background backdrop
    if (e.target === mobileMenu && drawer) {
        closeMobileDrawer(mobileMenu, drawer);
    }
});

function closeMobileDrawer(mobileMenu, drawer) {
    drawer.classList.add('-translate-x-full');
    mobileMenu.classList.add('opacity-0');
    mobileMenu.classList.add('pointer-events-none');

    setTimeout(() => {
        mobileMenu.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }, 300);
}

// Partial Injections Event Initialization
document.addEventListener("partialsLoaded", () => {
    initSearchFeature();
    updateCartAndAuthStatus();
});

document.addEventListener("cartUpdated", () => {
    updateCartAndAuthStatus();
});

// Search Feature Integration
// Search Feature Integration
function initSearchFeature() {
    const searchOpenBtn = document.getElementById('search-open-btn');
    const searchCloseBtn = document.getElementById('search-close-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const isMoreProductPage = window.location.pathname.includes('moreproduct.html') || window.location.pathname === '/products';

    if (!searchContainer || !searchInput) return;

    let suggestionsBox = document.getElementById('search-suggestions');
    if (!suggestionsBox && searchInput.parentElement && !isMoreProductPage) {
        suggestionsBox = document.createElement('div');
        suggestionsBox.id = 'search-suggestions';
        searchInput.parentElement.appendChild(suggestionsBox);
    }

    if (suggestionsBox) {
        suggestionsBox.className = 'absolute left-0 right-0 top-full bg-white text-black shadow-2xl rounded-b hidden z-[9999] max-h-60 overflow-y-auto border border-gray-200 mt-1';
    }

    searchOpenBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        searchContainer.classList.toggle('hidden');
        if (!searchContainer.classList.contains('hidden')) {
            searchInput.focus();
        }
    });

    searchCloseBtn?.addEventListener('click', () => {
        searchContainer.classList.add('hidden');
        if (suggestionsBox) suggestionsBox.classList.add('hidden');
        searchInput.value = '';
    });

    // Handle Enter key for redirecting to moreproduct page
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/products?search=${encodeURIComponent(query)}`;
            }
        }
    });

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            if (suggestionsBox) suggestionsBox.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                let products = [];

                // 1. Try Backend Search API
                try {
                    const response = await fetch(`${BASE_URL}/api/product/search?q=${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && Array.isArray(data.products)) {
                            products = data.products;
                        } else if (Array.isArray(data)) {
                            products = data;
                        }
                    }
                } catch (apiErr) {
                    console.warn("Backend search endpoint failed, falling back to all products:", apiErr);
                }

                // 2. Client-side fallback
                if (products.length === 0) {
                    try {
                        const allRes = await fetch(`${BASE_URL}/api/product/all`);
                        if (allRes.ok) {
                            const allData = await allRes.json();
                            if (Array.isArray(allData)) {
                                const qLower = query.toLowerCase();
                                products = allData.filter(p => {
                                    const name = (p.name || p.title || '').toLowerCase();
                                    const cat = (p.category || '').toLowerCase();
                                    const desc = (p.description || '').toLowerCase();
                                    return name.includes(qLower) || cat.includes(qLower) || desc.includes(qLower);
                                });
                            }
                        }
                    } catch (allErr) {
                        console.error("Fallback product fetch error:", allErr);
                    }
                }

if (products.length > 0 && suggestionsBox) {
    suggestionsBox.innerHTML = products.map(product => {
        const imageSrc = getImageUrl(product.imagepath, './static/placeholder.png');
        const rawPrice = (product.variants && product.variants.length > 0 && product.variants[0] && product.variants[0].price != null)
            ? product.variants[0].price
            : (product.price ?? product.discountprice ?? product.productPrice ?? 'N/A');
        
        const cleanedPrice = (rawPrice === 'N/A' || rawPrice == null) ? '' : String(rawPrice).replace(/[^\d.]/g, '').trim();
        
        const displayPrice = cleanedPrice ? `${RUPEE_SYMBOL} ${cleanedPrice}` : '';

        return `
            <div onclick="window.location.href='${getProductUrl(product)}'" class="flex items-center gap-3 p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0 transition text-left">
                <img src="${imageSrc}" alt="${product.name || 'Product'}" class="w-10 h-10 object-contain rounded bg-stone-50 border border-stone-200" onerror="this.src='./static/placeholder.png'">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-black truncate text-left">${product.name || product.title || ''}</p>
                    ${displayPrice ? `<p class="text-[11px] text-[#A0522D] font-bold text-left" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Symbol', sans-serif;">${displayPrice}</p>` : ''}
                </div>
                <i class="fa-solid fa-chevron-right text-[10px] text-stone-400 pr-1"></i>
            </div>
        `;
    }).join('');
    suggestionsBox.classList.remove('hidden');
}else if (suggestionsBox) {
                    suggestionsBox.innerHTML = `<p class="p-4 text-xs text-stone-500 text-center font-medium">No products found for "<i>${query}</i>"</p>`;
                    suggestionsBox.classList.remove('hidden');
                }
            } catch (error) {
                console.error("Frontend Search error:", error);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target) && !searchOpenBtn?.contains(e.target)) {
            searchContainer.classList.add('hidden');
            if (suggestionsBox) suggestionsBox.classList.add('hidden');
        }
    });
}

// Cart & Auth Sync
function updateCartAndAuthStatus() {
    const cartBadge = document.getElementById('global-cart-badge');
    const authActions = document.getElementById('auth-actions');

    // Compute canonical cart count directly from storage arrays to avoid stale values
    let cartCount = 0;
    try {
        const primary = JSON.parse(localStorage.getItem('glowCart') || '[]');
        if (Array.isArray(primary) && primary.length > 0) {
            cartCount = primary.reduce((t, it) => t + (parseInt(it.qty || it.qtyCountOrderMetric || 0) || 0), 0);
        } else {
            const legacy = JSON.parse(localStorage.getItem('glowRitualCartData') || '[]');
            if (Array.isArray(legacy) && legacy.length > 0) {
                cartCount = legacy.reduce((t, it) => t + (parseInt(it.qty || it.qtyCountOrderMetric || 0) || 0), 0);
            }
        }
    } catch (err) {
        console.warn('Error computing cart count for navbar:', err);
    }

    const token = localStorage.getItem('token');

    // Update all visible cart badges
    document.querySelectorAll('#global-cart-badge, .cart-badge, #cart-count').forEach(b => { if (b) b.innerText = String(cartCount); });
    localStorage.setItem('cartCount', String(cartCount));

    if (authActions && token) {
        authActions.innerHTML = `
            <a href="./profile.html" class="text-base text-black hover:text-gold transition">
                <i class="fa-solid fa-user-check text-green-700"></i>
            </a>
            <button id="logout-btn" class="text-xs font-semibold text-red-600 hover:underline uppercase ml-2">Logout</button>
        `;

        document.getElementById('logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            alert("Logged out successfully");
            window.location.reload();
        });
    }
}
