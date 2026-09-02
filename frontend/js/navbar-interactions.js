import BASE_URL, { getImageUrl, getProductUrl } from './config.js';
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
});
document.addEventListener('cartUpdated', updateCartAndAuthStatus);

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
}
