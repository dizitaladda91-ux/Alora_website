import BASE_URL, { getImageUrl, safeFetchJson, getProductUrl } from "./config.js";

// ===== Global State =====
let PRODUCTS_DATABASE = [];
let selectedCategories = [];
let maxPriceConstraint = 2500;
let ratingFloorFilter = 0;
let activeQuickTag = 'all';
let searchQuery = '';

let pendingCatalogProductId = null;
let pendingCatalogCartAction = null;

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
    // 1. URL Query Parameters check karein (?filter=bestseller YA ?category=body)
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    const categoryParam = urlParams.get('category');

    // Handle Bestseller filter
    if (filterParam === 'bestseller') {
        activeQuickTag = 'bestseller';
    }

    // Handle Category filter (e.g. body, skin)
    if (categoryParam) {
        const cleanCategory = categoryParam.toLowerCase().trim();
        selectedCategories = [cleanCategory];

        // Sidebar Checkbox ko Auto-Check karein
        const targetCheckbox = document.querySelector(`input[name="category"][value="${cleanCategory}"]`);
        if (targetCheckbox) {
            targetCheckbox.checked = true;
        }
    }

    // 2. Load Products & Setup
    loadProductsFromBackend();
    syncCartCounterIcon();
    setupMobileMenu();
    setupSearchListeners();
});

// ===== Fetch Backend Data =====
async function loadProductsFromBackend() {
    const gridContainer = document.getElementById('product-grid');
    if (!gridContainer) return;

    try {
        const data = await safeFetchJson(`${BASE_URL}/api/product/all`);
        PRODUCTS_DATABASE = normalizeAndAssignBestsellers(data);
        
        // Update Quick Filter UI Buttons state if redirected from Index
        updateQuickFilterUI();

        // Initial Filter Call (Respects URL query param)
        filterProducts();

        // Smoothly reveal sidebar filter controls with YouTube-style fade-in
        const filterSkeleton = document.getElementById('filter-skeleton');
        const filterContent = document.getElementById('filter-content');
        if (filterSkeleton && filterContent) {
            filterSkeleton.classList.add('hidden');
            filterContent.classList.remove('hidden');
            filterContent.classList.add('animate-fade-in');
        }

    } catch (err) {
        console.error("Product fetch failed:", err);
        gridContainer.innerHTML = `<p class="text-ash text-center col-span-full py-10">Could not load products. Please try again later.</p>`;
    }
}

// Normalize DB structure & Smartly Handle Bestsellers from Frontend
function normalizeAndAssignBestsellers(rawProducts) {
    let normalized = rawProducts.map(product => {
        const sizes = (product.variants && product.variants.length > 0)
            ? product.variants.map(v => ({
                ml: v.volume || "Standard",
                price: v.price || 0,
                mrp: v.comparePrice || v.price || 0
              }))
            : [{ ml: "Standard", price: product.price || 0, mrp: product.comparePrice || product.price || 0 }];

        let rawCategory = (product.category || "uncategorized").toLowerCase().trim();
        if (rawCategory === 'skincare') rawCategory = 'skin';
        if (rawCategory === 'bodycare') rawCategory = 'body';

        const imageSrc = getImageUrl(product.imagepath, '');

        const backendIsBestseller = Boolean(
            product.isBestseller === true || 
            product.isBestseller === 'true' || 
            product.bestseller === true || 
            product.bestseller === 'true'
        );

        return {
            id: product._id || product.id,
            slug: product.slug,
            productUrl: getProductUrl(product),
            name: product.name || 'Untitled Product',
            category: rawCategory, 
            isBestseller: backendIsBestseller,
            rating: product.rating || 4,
            baseImg: imageSrc,
            galleryImages: (product.galleryImages || []).map(img => getImageUrl(img, '')).filter(Boolean),
            description: product.description || 'No description available', 
            sizes
        };
    });

    const hasAnyBackendBestseller = normalized.some(p => p.isBestseller);

    if (!hasAnyBackendBestseller && normalized.length > 0) {
        const sortedIndices = [...normalized]
            .map((p, idx) => ({ idx, rating: p.rating }))
            .sort((a, b) => b.rating - a.rating);

        const bestsellerCount = Math.max(2, Math.min(6, Math.ceil(normalized.length * 0.3)));
        
        for (let i = 0; i < Math.min(bestsellerCount, normalized.length); i++) {
            const targetIdx = sortedIndices[i].idx;
            normalized[targetIdx].isBestseller = true;
        }
    }

    return normalized;
}

// ===== Render Catalog =====
function renderProductCatalog(products) {
    const gridContainer = document.getElementById('product-grid');
    const noProductsPlaceholder = document.getElementById('no-products');

    if (!gridContainer) return;

    if (products.length === 0) {
        gridContainer.innerHTML = "";
        if (noProductsPlaceholder) noProductsPlaceholder.classList.remove('hidden');
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.innerText = `0 Products Found`;
        return;
    }

    if (noProductsPlaceholder) noProductsPlaceholder.classList.add('hidden');
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.innerText = `Showing ${products.length} products`;

    gridContainer.innerHTML = products.map(product => {
        const initialSize = product.sizes[0];
        const starsHTML = generateStarsHTML(product.rating);

        const allImages = [product.baseImg, ...(product.galleryImages || [])].filter(Boolean);
        const hasMultipleImages = allImages.length > 1;

        const sizeButtonsHTML = product.sizes.map((sz, idx) => {
            const isActive = idx === 0;
            const activeClasses = isActive 
                ? 'bg-ink text-parchment border-ink font-semibold' 
                : 'border-[#DCD3BA] text-ash hover:border-ink';

            return `
                <button 
                    type="button"
                    onclick="changeCardSize('${sz.ml}', ${sz.price}, ${sz.mrp || 0}, this)"
                    class="size-btn text-[11px] px-2.5 py-1 rounded-full border transition ${activeClasses}"
                >
                    ${sz.ml}
                </button>
            `;
        }).join('');

        const imageAreaHTML = hasMultipleImages ? `
            <div class="mx-4 mt-4 rounded-xl flex justify-center h-[170px] items-center overflow-hidden relative group/card-img" data-images="${encodeURIComponent(JSON.stringify(allImages))}" data-active-idx="0">
                <a href="${product.productUrl}" class="block w-full h-full p-2 flex items-center justify-center">
                    <img src="${allImages[0]}" alt="${product.name}" class="card-active-img max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-110">
                </a>
                <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.cycleCardImage(this, -1)" class="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center text-[10px] opacity-80 sm:opacity-0 group-hover/card-img:opacity-100 transition hover:bg-black/80 z-20 shadow">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.cycleCardImage(this, 1)" class="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center text-[10px] opacity-80 sm:opacity-0 group-hover/card-img:opacity-100 transition hover:bg-black/80 z-20 shadow">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 z-20 bg-black/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                    ${allImages.map((_, i) => `<span class="img-dot w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-clay' : 'bg-white/60'}"></span>`).join('')}
                </div>
            </div>
        ` : `
            <div class="mx-4 mt-4 rounded-xl flex justify-center h-[170px] items-center overflow-hidden relative">
                <a href="${product.productUrl}" class="block w-full h-full p-2 flex items-center justify-center">
                    <img src="${product.baseImg}" alt="${product.name}" class="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-110">
                </a>
            </div>
        `;

        return `
        <div data-product-id="${product.id}" class="animate-fade-in relative w-full flex-shrink-0 product-card bg-gradient-to-b from-[#FFFDF9] via-white to-[#FFFDF9] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 border border-amber-900/15 flex flex-col justify-between transition-all duration-300 group overflow-hidden">
            
            <!-- Top Badges Bar -->
            <div class="flex items-center justify-between z-10 mb-1.5">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full ${product.isBestseller ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold' : 'bg-slate-900 text-white font-bold'} text-[9px] sm:text-[10px] uppercase tracking-wider shadow-xs">
                    ${product.isBestseller ? 'BESTSELLER' : 'NEW'}
                </span>
                <span class="text-[9px] sm:text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-200 uppercase font-mono">
                    30% OFF
                </span>
            </div>

            <!-- Image Area (Seamless Blend) -->
            <div class="w-full flex justify-center items-center h-[140px] sm:h-[180px] overflow-hidden relative my-1 sm:my-2">
                <a href="${product.productUrl}" class="block w-full h-full flex items-center justify-center">
                    <img src="${product.baseImg}" alt="${product.name}" class="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-108 filter drop-shadow-sm">
                </a>
            </div>

            <!-- Product Info Section -->
            <div class="flex-1 flex flex-col justify-between space-y-1.5 mb-2.5">
                <div>
                    <h3 class="text-xs sm:text-sm font-fraunces font-bold text-slate-900 text-center leading-snug group-hover:text-[#8B4513] transition-colors capitalize line-clamp-1 product-name">${product.name}</h3>
                    <p class="product-desc-text text-[10px] sm:text-[11px] text-slate-600 text-center font-sans mt-0.5 line-clamp-2 min-h-[1.8rem] sm:min-h-[2.2rem] leading-tight sm:leading-relaxed">
                        ${product.description || 'Dermatologist-tested luxury formulation.'}
                    </p>
                </div>

                <!-- Rating Stars Row -->
                <div class="flex items-center justify-center gap-1 text-[11px] text-amber-500 font-bold">
                    <div class="flex gap-0.5 text-amber-500 text-[10px] sm:text-[11px]">${starsHTML}</div>
                    <span class="text-[9px] sm:text-[10px] text-slate-500 font-mono font-semibold">(${product.rating || '4.9'})</span>
                </div>

                <!-- Size Variant Buttons -->
                <div class="flex justify-center items-center gap-1 sm:gap-1.5 flex-wrap size-btn-container">
                    ${sizeButtonsHTML}
                </div>

                <!-- Price Display -->
                <div class="flex items-baseline justify-center gap-1.5 pt-0.5">
                    <span class="product-price font-fraunces font-bold text-[#8B4513] text-base sm:text-lg">₹${initialSize.price}</span>
                    <span class="product-mrp text-[11px] sm:text-xs line-through text-slate-400 font-mono">${initialSize.mrp ? '₹' + initialSize.mrp : ''}</span>
                </div>
            </div>

            <!-- Add to Cart Action Bar -->
            <div class="pt-1">
                <button type="button" onclick="handleCartButtonClick('${product.id}', this)" class="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-amber-500/25 transform active:scale-95">
                    <i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart
                </button>
            </div>
        </div>`;
    }).join('');
}

// ===== Rating Stars Helper =====
function generateStarsHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            html += `<i class="fa-solid fa-star"></i>`;
        } else if (i - 0.5 <= rating) {
            html += `<i class="fa-solid fa-star-half-stroke"></i>`;
        } else {
            html += `<i class="fa-regular fa-star text-gray-300"></i>`;
        }
    }
    return html;
}

// ===== Size Switch =====
function changeCardSize(sizeLabel, exactPrice, exactMrp, element) {
    const currentCard = element.closest('.product-card');
    if (!currentCard) return;

    currentCard.querySelector('.product-price').innerText = `₹${exactPrice}`;
    const mrpEl = currentCard.querySelector('.product-mrp');
    if (mrpEl) mrpEl.innerText = exactMrp ? `₹${exactMrp}` : '';

    currentCard.querySelectorAll('.size-btn').forEach(btn => {
        btn.className = "size-btn text-[11px] px-2.5 py-1 rounded-full border border-[#DCD3BA] text-ash hover:border-ink transition";
    });

    element.className = "size-btn text-[11px] px-2.5 py-1 rounded-full border border-ink bg-ink text-parchment font-semibold transition";
}

// ===== Quantity Stepper =====
function updateQty(change, element) {
    const parentQtyWrapper = element.closest('.qty-container');
    const targetInput = parentQtyWrapper.querySelector('.quantity');

    let currentQty = parseInt(targetInput.value) || 1;
    currentQty += change;

    if (currentQty < 1) currentQty = 1;
    targetInput.value = currentQty;
}

// ===== Filters & Search Logic =====
function filterProducts() {
    const checkboxes = document.querySelectorAll('input[name="category"]:checked');
    selectedCategories = Array.from(checkboxes).map(cb => cb.value.toLowerCase().trim());

    const priceRangeInput = document.getElementById('price-range');
    if (priceRangeInput) maxPriceConstraint = parseInt(priceRangeInput.value);

    let results = PRODUCTS_DATABASE.filter(item => {
        if (searchQuery) {
            const matchesName = item.name.toLowerCase().includes(searchQuery);
            const matchesDesc = item.description.toLowerCase().includes(searchQuery);
            const matchesCategory = item.category.toLowerCase().includes(searchQuery);
            if (!matchesName && !matchesDesc && !matchesCategory) return false;
        }

        if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
            return false;
        }

        if (item.rating < ratingFloorFilter) return false;

        if (activeQuickTag === 'bestseller' && !item.isBestseller) {
            return false;
        }

        const basePrice = item.sizes[0].price;
        if (basePrice > maxPriceConstraint) return false;

        return true;
    });

    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        const sortSelection = sortFilter.value;
        if (sortSelection === 'price-low-high') {
            results.sort((a, b) => a.sizes[0].price - b.sizes[0].price);
        } else if (sortSelection === 'price-high-low') {
            results.sort((a, b) => b.sizes[0].price - a.sizes[0].price);
        } else if (sortSelection === 'rating-high-low') {
            results.sort((a, b) => b.rating - a.rating);
        }
    }

    renderProductCatalog(results);
}

function updateQuickFilterUI() {
    const bestsellerBadge = document.getElementById('badge-bestseller');
    if (bestsellerBadge) {
        if (activeQuickTag === 'bestseller') bestsellerBadge.classList.remove('hidden');
        else bestsellerBadge.classList.add('hidden');
    }

    const buttons = document.querySelectorAll('[onclick*="applyQuickFilter"]');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(activeQuickTag)) {
            btn.classList.add('border-[#E3D9BC]', 'bg-clay/10', 'font-bold');
        } else {
            btn.classList.remove('border-[#E3D9BC]', 'bg-clay/10', 'font-bold');
        }
    });
}

function applyQuickFilter(mode) {
    activeQuickTag = mode;
    updateQuickFilterUI();
    filterProducts();
}

function updatePriceLabel(value) {
    const label = document.getElementById('price-max-label');
    if (label) label.innerText = `₹${value}`;
}

function setRatingFilter(minStars) {
    ratingFloorFilter = minStars;
    filterProducts();
}

function resetFilters() {
    document.querySelectorAll('input[name="category"]').forEach(cb => cb.checked = false);
    const range = document.getElementById('price-range');
    if (range) range.value = 2500;
    const sort = document.getElementById('sort-filter');
    if (sort) sort.value = 'featured';
    
    updatePriceLabel(2500);
    ratingFloorFilter = 0;
    activeQuickTag = 'all';
    searchQuery = '';
    
    document.querySelectorAll('#search-input, .search-bar').forEach(input => input.value = '');

    updateQuickFilterUI();
    filterProducts();
}

// ===== Search Listeners & Suggestions =====
function setupSearchListeners() {
    document.addEventListener('input', async (e) => {
        const input = e.target;
        if (!input || (input.id !== 'search-input' && !input.classList.contains('search-bar') && input.type !== 'search')) {
            return;
        }

        const query = input.value.toLowerCase().trim();
        searchQuery = query;

        filterProducts();
        await fetchAndShowSuggestions(query);
    });
}

async function fetchAndShowSuggestions(query) {
    const searchContainer = document.getElementById('search-container');
    if (!searchContainer) return;

    let suggestionsBox = document.getElementById('search-suggestions-box') || document.getElementById('search-suggestions');
    if (!suggestionsBox) {
        suggestionsBox = document.createElement('div');
        suggestionsBox.id = 'search-suggestions-box';
        suggestionsBox.className = 'absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-xl shadow-2xl max-h-80 overflow-y-auto z-50 mt-1';
        searchContainer.appendChild(suggestionsBox);
    }

    if (!query) {
        suggestionsBox.innerHTML = '';
        suggestionsBox.classList.add('hidden');
        return;
    }

    try {
        const data = await safeFetchJson(`${BASE_URL}/api/product/all`);

        const matches = data.filter(item => {
            const name = (item.name || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return name.includes(query) || cat.includes(query);
        });

        if (matches.length === 0) {
            suggestionsBox.innerHTML = `<div class="p-4 text-center text-sm text-gray-400">No matching products found</div>`;
            suggestionsBox.classList.remove('hidden');
            return;
        }

        suggestionsBox.innerHTML = matches.map(prod => {
            const imgSrc = getImageUrl(prod.imagepath, '');
            const rawPrice = (prod.variants && prod.variants.length > 0 && prod.variants[0] && prod.variants[0].price != null)
                ? prod.variants[0].price
                : (prod.price ?? prod.discountprice ?? prod.productPrice ?? 'N/A');
            const cleanedPrice = (rawPrice === 'N/A' || rawPrice == null) ? '' : String(rawPrice).replace(/[^\d.]/g, '').trim();
            const displayPrice = cleanedPrice ? `₹ ${cleanedPrice}` : '';

            return `
                <a href="${getProductUrl(prod)}" class="flex items-center gap-3 p-3 hover:bg-amber-50/50 transition border-b border-gray-100 last:border-none group">
                    <img src="${imgSrc}" alt="${prod.name}" class="w-10 h-10 object-contain rounded bg-white border p-1">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate group-hover:text-amber-700">${prod.name}</p>
                        ${displayPrice ? `<p class="text-xs text-amber-800 font-semibold" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Symbol', sans-serif;">${displayPrice}</p>` : ''}
                    </div>
                    <i class="fa-solid fa-chevron-right text-xs text-gray-300 group-hover:text-amber-700"></i>
                </a>
            `;
        }).join('');

        suggestionsBox.classList.remove('hidden');
    } catch (err) {
        console.error("Error fetching suggestions:", err);
    }
}

// ===== Cart =====
function handleCartButtonClick(productId, buttonElement) {
    commitProductToCart(productId, buttonElement);
}

function commitProductToCart(productId, actionBtnElement) {
    const cardElement = actionBtnElement.closest('.product-card');
    if (!cardElement) return;

    const activeSelectedSizeBtn = cardElement.querySelector('.size-btn-container .bg-ink');
    const targetSizeText = activeSelectedSizeBtn ? activeSelectedSizeBtn.innerText.trim() : "Standard";

    const selectedRawPriceText = cardElement.querySelector('.product-price').innerText;
    const parsedPriceVal = parseInt(selectedRawPriceText.replace(/[^\d.]/g, '').trim()) || 0;

    const currentQtyVal = parseInt(cardElement.querySelector('.quantity').value) || 1;
    const targetNameText = cardElement.querySelector('.product-name').innerText;
    
    const descriptionElement = cardElement.querySelector('.product-desc-text');
    const targetDescText = descriptionElement ? descriptionElement.innerText.trim() : 'No description available';

    const imgElement = cardElement.querySelector('img');
    const targetImgSrc = imgElement ? imgElement.getAttribute('src') : '';

    let localCartArr = JSON.parse(localStorage.getItem('glowRitualCartData')) || [];

    const uniqueCartKey = `${productId}_${targetSizeText}`;
    let matchingItem = localCartArr.find(cartItem => cartItem.uniqueCartItemKeyId === uniqueCartKey);

    if (matchingItem) {
        matchingItem.qtyCountOrderMetric += currentQtyVal;
    } else {
        localCartArr.push({
            uniqueCartItemKeyId: uniqueCartKey,
            productId: productId,
            productName: targetNameText,
            productDescription: targetDescText,
            activeSelectedSizeConfig: targetSizeText,
            unitPriceItemConfig: parsedPriceVal,
            qtyCountOrderMetric: currentQtyVal,
            baseImg: targetImgSrc
        });
    }

    localStorage.setItem('glowRitualCartData', JSON.stringify(localCartArr));
    document.dispatchEvent(new Event('cartUpdated'));

    const primary = JSON.parse(localStorage.getItem('glowCart') || '[]');
    const legacy = JSON.parse(localStorage.getItem('glowRitualCartData') || '[]');
    const total = (Array.isArray(primary) && primary.length > 0 ? primary : legacy).reduce((t, it) => t + (parseInt(it.qty || it.qtyCountOrderMetric || 0) || 0), 0);
    
    document.querySelectorAll('#global-cart-badge, .cart-badge, #cart-count').forEach(b => { if (b) b.innerText = String(total); });
    localStorage.setItem('cartCount', String(total));

    syncCartCounterIcon();

    const cardImg = cardElement ? cardElement.querySelector("img") : null;
    if (cardImg && typeof window.flyToCartAnimation === "function") {
        window.flyToCartAnimation(cardImg);
    } else if (typeof window.updateHeaderCartCount === 'function') {
        window.updateHeaderCartCount();
    }

    const backupText = actionBtnElement.innerHTML;
    actionBtnElement.innerHTML = `<i class="fa-solid fa-circle-check text-xs"></i> Item Added!`;
    actionBtnElement.classList.replace('bg-[#A0522D]', 'bg-green-600');

    setTimeout(() => {
        actionBtnElement.innerHTML = backupText;
        actionBtnElement.classList.replace('bg-green-600', 'bg-[#A0522D]');
        const inputQty = cardElement.querySelector('.quantity');
        if (inputQty) inputQty.value = 1;
    }, 1200);
}

function syncCartCounterIcon() {
    const countDisplay = document.getElementById('cart-count');

    let netSum = 0;
    try {
        const primary = JSON.parse(localStorage.getItem('glowCart') || '[]');
        if (Array.isArray(primary) && primary.length > 0) {
            netSum = primary.reduce((total, item) => total + (parseInt(item.qty || item.qtyCountOrderMetric || 0) || 0), 0);
        } else {
            const legacy = JSON.parse(localStorage.getItem('glowRitualCartData') || '[]');
            if (Array.isArray(legacy) && legacy.length > 0) {
                netSum = legacy.reduce((total, item) => total + (parseInt(item.qtyCountOrderMetric || item.qty || 0) || 0), 0);
            }
        }
    } catch (err) {
        console.warn('Error reading cart for syncCartCounterIcon:', err);
    }

    if (countDisplay) countDisplay.innerText = netSum;
    document.querySelectorAll('#global-cart-badge, .cart-badge').forEach(b => { if (b) b.innerText = String(netSum); });
    localStorage.setItem('cartCount', String(netSum));
}

document.addEventListener('cartUpdated', () => {
    try { syncCartCounterIcon(); } catch (e) { console.warn('cartUpdated handler failed', e); }
});

// ===== Mobile Menu & Mobile Filter Listener =====
function setupMobileMenu() {
    document.addEventListener("click", (e) => {
        const menuBtn = e.target.closest("#menu-btn") || e.target.closest(".mobile-menu-toggle");
        const closeBtn = e.target.closest("#menu-close-btn");
        const mobileMenu = document.getElementById("mobile-menu");
        const mobileDrawer = document.getElementById("mobile-menu-drawer");

        if (menuBtn && mobileMenu) {
            e.preventDefault();
            mobileMenu.classList.remove("hidden", "pointer-events-none", "opacity-0");
            if (mobileDrawer) {
                mobileDrawer.classList.remove("-translate-x-full");
            }
            return;
        }

        if ((closeBtn || e.target === mobileMenu) && mobileMenu) {
            e.preventDefault();
            if (mobileDrawer) {
                mobileDrawer.classList.add("-translate-x-full");
            }
            mobileMenu.classList.add("opacity-0");
            setTimeout(() => {
                mobileMenu.classList.add("hidden", "pointer-events-none");
            }, 300);
            return;
        }

        // Toggle Mobile Filter Sidebar Drawer
        const toggleFilterBtn = e.target.closest("#toggle-filter-btn");
        const closeFilterBtn = e.target.closest("#close-filter-btn");
        const backdrop = document.getElementById("filter-backdrop");
        const sidebar = document.getElementById("filter-sidebar");

        if (toggleFilterBtn && sidebar) {
            e.preventDefault();
            sidebar.classList.remove("hidden");
            if (backdrop) backdrop.classList.remove("hidden");
            requestAnimationFrame(() => {
                sidebar.classList.remove("translate-y-full");
                if (backdrop) backdrop.classList.remove("opacity-0");
            });
            document.body.style.overflow = "hidden";
            return;
        }

        if ((closeFilterBtn || e.target === backdrop) && sidebar) {
            e.preventDefault();
            sidebar.classList.add("translate-y-full");
            if (backdrop) backdrop.classList.add("opacity-0");
            setTimeout(() => {
                if (backdrop) backdrop.classList.add("hidden");
                document.body.style.overflow = "auto";
            }, 300);
            return;
        }
    });
}

// ===== Search Overlay Toggle =====
document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('#search-open-btn');
    if (openBtn) {
        e.preventDefault();
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) {
            searchContainer.classList.remove('hidden');
            const input = document.getElementById('search-input');
            if (input) input.focus();
        }
        return;
    }

    const closeBtn = e.target.closest('#search-close-btn');
    if (closeBtn) {
        e.preventDefault();
        const searchContainer = document.getElementById('search-container');
        if (searchContainer) {
            searchContainer.classList.add('hidden');
        }
        return;
    }
});

// ===== Product Card Image Slider Cycle & Mobile Touch Swipe =====
window.cycleCardImage = function(btnElement, direction) {
    const container = btnElement.closest('[data-images]');
    if (!container) return;
    try {
        const rawImages = JSON.parse(decodeURIComponent(container.dataset.images || "[]"));
        if (!rawImages.length) return;
        let currentIdx = parseInt(container.dataset.activeIdx || "0");
        currentIdx = (currentIdx + direction + rawImages.length) % rawImages.length;
        container.dataset.activeIdx = String(currentIdx);

        const imgEl = container.querySelector('.card-active-img');
        if (imgEl) imgEl.src = rawImages[currentIdx];

        const dots = container.querySelectorAll('.img-dot');
        dots.forEach((dot, idx) => {
            if (idx === currentIdx) {
                dot.className = "img-dot w-1.5 h-1.5 rounded-full bg-clay";
            } else {
                dot.className = "img-dot w-1.5 h-1.5 rounded-full bg-white/60";
            }
        });
    } catch (e) {
        console.error("Image cycle error:", e);
    }
};

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    const cardImgBox = e.target.closest('[data-images]');
    if (cardImgBox) {
        touchStartX = e.changedTouches[0].screenX;
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const cardImgBox = e.target.closest('[data-images]');
    if (cardImgBox) {
        touchEndX = e.changedTouches[0].screenX;
        const diffX = touchEndX - touchStartX;
        if (Math.abs(diffX) > 35) {
            const direction = diffX < 0 ? 1 : -1;
            const nextBtn = cardImgBox.querySelector(direction === 1 ? 'button:nth-of-type(2)' : 'button:nth-of-type(1)');
            if (nextBtn) window.cycleCardImage(nextBtn, direction);
        }
    }
}, { passive: true });

// ===== Expose Global Functions for Inline HTML Event Listeners =====
window.changeCardSize = changeCardSize;
window.updateQty = updateQty;
window.filterProducts = filterProducts;
window.updatePriceLabel = updatePriceLabel;
window.setRatingFilter = setRatingFilter;
window.applyQuickFilter = applyQuickFilter;
window.resetFilters = resetFilters;
window.commitProductToCart = commitProductToCart;
window.handleCartButtonClick = handleCartButtonClick;

document.addEventListener('partialsLoaded', () => {
    try { syncCartCounterIcon(); } catch (e) { console.warn('partialsLoaded sync failed', e); }
    if (typeof window.updateHeaderCartCount === 'function') {
        try { window.updateHeaderCartCount(); } catch (e) { console.warn('updateHeaderCartCount failed', e); }
    }
});
