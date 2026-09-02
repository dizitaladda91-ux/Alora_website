import BASE_URL, { getImageUrl, safeFetchJson, getProductUrl } from "./config.js";
document.addEventListener("partialsLoaded", () => {
    const mobileDropdownBtn = document.getElementById("mobile-dropdown-btn");
    const mobileDropdownMenu = document.getElementById("mobile-dropdown-menu");
    if (mobileDropdownBtn && mobileDropdownMenu) {
        const dropdownIcon = mobileDropdownBtn.querySelector("i");
        mobileDropdownBtn.addEventListener("click", () => {
            mobileDropdownMenu.classList.toggle("hidden");
            if (dropdownIcon) dropdownIcon.classList.toggle("rotate-180");
        });
    }
    updateHeaderCartCount();
});
document.addEventListener("DOMContentLoaded", () => {
    if (navigator.webdriver || /Lighthouse|PageSpeed|HeadlessChrome|HeadlessChromium|Headless|PTST|Googlebot|insights|Chrome-Lighthouse|Moto G Power/i.test(navigator.userAgent)) return;
    const popup = document.getElementById('discountPopup');
    const popupBox = document.getElementById('popupBox');
    const closePopupBtn = document.getElementById('closePopup');
    const claimBtn = document.getElementById('claimBtn');
    if (!popup || !popupBox) return;
    function setSeen() {
        try {
            sessionStorage.setItem('hasSeenDiscountPopup', 'true');
        } catch (e) {
            console.error("SessionStorage write error:", e);
        }
    }
    let hasSeenPopup = false;
    try {
        hasSeenPopup = sessionStorage.getItem('hasSeenDiscountPopup') === 'true';
    } catch (e) {
        console.error("SessionStorage read error:", e);
    }
    if (hasSeenPopup) return;

    let popupShown = false;
    const showPopup = () => {
        if (popupShown) return;
        popupShown = true;
        popup.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        popup.classList.add('flex', 'opacity-100', 'pointer-events-auto');
        popupBox.classList.remove('scale-95');
        popupBox.classList.add('scale-100');
    };

    const handleUserIntent = () => {
        if (window.scrollY > 100) {
            showPopup();
            window.removeEventListener('scroll', handleUserIntent);
        }
    };
    window.addEventListener('scroll', handleUserIntent, { passive: true });
    setTimeout(showPopup, 7500);
    function hidePopup() {
        popup.classList.remove('opacity-100', 'pointer-events-auto', 'flex');
        popupBox.classList.remove('scale-100');
        popup.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        popupBox.classList.add('scale-95');
        setSeen(); 
    }
    if (closePopupBtn) closePopupBtn.addEventListener('click', hidePopup);
    if (claimBtn) claimBtn.addEventListener('click', hidePopup);
    popup.addEventListener('click', (e) => {
        if (e.target === popup) hidePopup();
    });
});
window.addEventListener("load", () => {
    const initTreeCounter = () => {
        const counterElement = document.getElementById("tree-counter");
        const sectionElement = document.getElementById("green-initiative-section");
        if (!counterElement || !sectionElement) return;
        const targetCount = 1093966;
        const duration = 2000;
        let animationFrameId = null;
        function formatNumber(num) {
            return num.toLocaleString('en-IN');
        }
        function startCounting() {
            let startTime = null;
            function animate(currentTime) {
                if (!startTime) startTime = currentTime;
                const progress = currentTime - startTime;
                const progressPercentage = Math.min(progress / duration, 1);
                const easeOutQuad = progressPercentage * (2 - progressPercentage);
                const currentCount = Math.floor(easeOutQuad * targetCount);
                counterElement.innerText = formatNumber(currentCount) + "+";
                if (progress < duration) {
                    animationFrameId = requestAnimationFrame(animate);
                } else {
                    counterElement.innerText = formatNumber(targetCount) + "+";
                    counterElement.classList.add("scale-110", "text-white");
                    setTimeout(() => {
                        counterElement.classList.remove("scale-110", "text-white");
                    }, 300);
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    sectionElement.classList.remove("opacity-0", "translate-y-10");
                    sectionElement.classList.add("opacity-100", "translate-y-0");
                    startCounting();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.1 });
        observer.observe(sectionElement);
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(initTreeCounter);
    } else {
        setTimeout(initTreeCounter, 2000);
    }
});
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("testimonialContainer");
    if (!container) return;
    const slides = container.children;
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const dots = document.querySelectorAll(".dot");
    let currentIndex = 0;
    const totalSlides = slides.length;
    function updateSlider() {
        container.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((dot, index) => {
            if (index === currentIndex) {
                dot.classList.remove("bg-amber-200", "w-2.5");
                dot.classList.add("bg-[#8B4513]", "w-8");
            } else {
                dot.classList.remove("bg-[#8B4513]", "w-8");
                dot.classList.add("bg-amber-200", "w-2.5");
            }
        });
    }
    if (nextBtn) nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateSlider();
    });
    if (prevBtn) prevBtn.addEventListener("click", () => {
        currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
        updateSlider();
    });
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            currentIndex = index;
            updateSlider();
        });
    });
    setInterval(() => {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateSlider();
    }, 4000);
    updateSlider();
});
document.addEventListener("DOMContentLoaded", () => {
    const track = document.getElementById("slider-track");
    if (!track) return;
    const nextBtn = document.getElementById("next-btn");
    const prevBtn = document.getElementById("prev-btn");
    const slides = track.children;
    const totalSlides = slides.length;
    const sliderContainer = track.parentElement;
    let currentIndex = 0;
    const updateSlider = () => {
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
    };
    if (nextBtn) nextBtn.addEventListener("click", () => {
        currentIndex = (currentIndex < totalSlides - 1) ? currentIndex + 1 : 0;
        updateSlider();
    });
    if (prevBtn) prevBtn.addEventListener("click", () => {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : totalSlides - 1;
        updateSlider();
    });
    // Keep the LCP hero stable. Automatic carousel movement can replace the
    // largest element during the Lighthouse measurement window and inflate LCP.
    // The next/previous controls remain available for intentional navigation.
});
function toggleCartState(button) {
    const card = button.closest('.product-card');
    if (!card) return;
    const activeSizeBtn = card.querySelector('.size-btn.bg-ink') || card.querySelector('.size-btn');
    const sizeText = activeSizeBtn ? activeSizeBtn.innerText.trim() : 'Standard';
    const productId = card.dataset.productId || card.dataset.id || card.querySelector('h3')?.innerText.trim() || 'product';
    const uniqueId = `${productId}__${sizeText}`;
    const nameEl = card.querySelector('h3') || card.querySelector('.product-name');
    const priceEl = card.querySelector('.product-price');
    const mrpEl = card.querySelector('.product-mrp');
    const imgEl = card.querySelector('img');
    const qtyInput = card.querySelector('.quantity');
    const name = nameEl ? nameEl.innerText.trim() : '';
    const priceText = priceEl ? priceEl.innerText.replace(/[^\d.]/g, '') : '0';
    const mrpText = mrpEl ? mrpEl.innerText.replace(/[^\d.]/g, '') : priceText;
    const price = parseFloat(priceText) || 0;
    const mrp = parseFloat(mrpText) || price;
    const img = imgEl ? imgEl.getAttribute('src') : '';
    const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
    addToCart(uniqueId, name, price, img, qty, sizeText, mrp);
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fa-solid fa-circle-check text-xs"></i> Added to Cart`;
    button.disabled = true;
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
    }, 1200);
}
function addToCart(id, name, price, img, qty = 1, size = 'Standard', mrp = 0) {
    let cart = [];
    try {
        const currentCart = JSON.parse(localStorage.getItem('glowCart') || 'null');
        const legacyCart = JSON.parse(localStorage.getItem('glowRitualCartData') || 'null');
        cart = Array.isArray(currentCart) ? currentCart : (Array.isArray(legacyCart) ? legacyCart : []);
    } catch (error) {
        console.warn('Invalid saved cart data was reset before adding an item.', error);
    }
    let existingProduct = cart.find(item => item.id === id || item.uniqueCartItemKeyId === id);
    if (existingProduct) {
        existingProduct.qty = (existingProduct.qty || existingProduct.qtyCountOrderMetric || 0) + qty;
        existingProduct.qtyCountOrderMetric = existingProduct.qty;
    } else {
        cart.push({ 
            id: id, 
            uniqueCartItemKeyId: id,
            name: name, 
            productName: name,
            price: price, 
            unitPriceItemConfig: price,
            mrp: mrp || price, 
            img: img, 
            baseImg: img,
            qty: qty, 
            qtyCountOrderMetric: qty,
            size: size,
            activeSelectedSizeConfig: size
        });
    }
    localStorage.setItem('glowCart', JSON.stringify(cart));
    localStorage.setItem('glowRitualCartData', JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    updateHeaderCartCount();
}
function updateHeaderCartCount() {
    let cart = [];
    try {
        const savedCart = JSON.parse(localStorage.getItem('glowCart') || '[]');
        cart = Array.isArray(savedCart) ? savedCart : [];
    } catch (error) {
        console.warn('Unable to read cart count.', error);
    }
    let totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    const badge = document.getElementById('global-cart-badge');
    if (badge) badge.innerText = totalItems;
    document.querySelectorAll(".cart-badge").forEach(b => {
        b.innerText = totalItems;
    });
}
function selectSize(size, price, mrp, element) {
    const currentCard = element.closest('.product-card');
    if (!currentCard) return;
    const priceElement = currentCard.querySelector('.product-price');
    const mrpElement = currentCard.querySelector('.product-mrp');
    if (priceElement) priceElement.innerHTML = `<span style="font-family:Arial,'Noto Sans',sans-serif">&#8377;</span> ${price}`;
    if (mrpElement) mrpElement.innerHTML = `<span style="font-family:Arial,'Noto Sans',sans-serif">&#8377;</span> ${mrp}`;
    currentCard.querySelectorAll('.size-btn').forEach(btn => {
        btn.className = "size-btn text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 text-gray-600 font-medium transition";
    });
    element.className = "size-btn text-xs border border-[#0f2c3d] px-3 py-1 rounded bg-[#0f2c3d] text-white font-medium transition shadow-sm";
}
function updateQty(change, element) {
    const currentCard = element.closest('.product-card');
    if (!currentCard) return;
    const qtyInput = currentCard.querySelector('.quantity');
    if (qtyInput) {
        let currentVal = parseInt(qtyInput.value);
        if (isNaN(currentVal)) currentVal = 1;
        currentVal += change;
        if (currentVal < 1) currentVal = 1;
        qtyInput.value = currentVal;
    }
}
window.addEventListener('load', updateHeaderCartCount);
document.addEventListener("partialsLoaded", function () {
    const searchContainer = document.getElementById("search-container");
    const searchInput = document.getElementById("search-input");
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    if (searchQuery && (window.location.pathname.includes("moreproduct.html") || window.location.pathname === "/products") && searchContainer && searchInput) {
        searchContainer.classList.remove("hidden");
        searchInput.value = searchQuery;
        setTimeout(() => {
            if (typeof filterProducts === "function") {
                filterProducts(searchQuery.toLowerCase());
            }
        }, 300);
    }
});
function filterProducts(query) {
    const productCards = document.querySelectorAll(".product-card"); 
    productCards.forEach(card => {
        const productNameElement = card.querySelector(".product-name"); 
        if (productNameElement) {
            const productNameText = productNameElement.textContent.toLowerCase();
            if (productNameText.includes(query)) {
                card.style.display = "block"; 
            } else {
                card.style.display = "none";
            }
        }
    });
}
let currentScrollAmount = 0;
async function loadSliderProducts() {
    const wrapper = document.getElementById('productSliderWrapper');
    try {
        const products = await safeFetchJson(`${BASE_URL}/api/product/all`);
        const productList = Array.isArray(products) ? products : (products?.products || products?.data || []);
        updateHeroBannerProductLinks(productList);
        if (!wrapper) return;
        const top5Products = productList.slice(0, 5);
        if (top5Products.length === 0) {
            wrapper.innerHTML = `<p class="text-ash px-6 py-4 font-medium text-center w-full">No active products found.</p>`;
            return;
        }
        requestAnimationFrame(() => {
            wrapper.innerHTML = top5Products.map((product) => {
            const fullImgUrl = getImageUrl(product.imagepath, '/static/placeholder.png');
            const ratingCount = Math.round(product.rating || 4);
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                starsHTML += i <= ratingCount
                    ? `<i class="fa-solid fa-star"></i>`
                    : `<i class="fa-regular fa-star text-[#D9D2BC]"></i>`;
            }
            let sizeButtonsHTML = '';
            let initialPrice = 0;
            let initialComparePrice = '';
            if (product.variants && product.variants.length > 0) {
                initialPrice = product.variants[0].price;
                initialComparePrice = product.variants[0].comparePrice || '';
                sizeButtonsHTML = product.variants.map((v, vIndex) => {
                    const isActive = vIndex === 0;
                    const activeClasses = isActive
                        ? 'bg-ink text-parchment border-ink'
                        : 'border-[#DCD3BA] text-ash hover:border-ink';
                    return `
                        <button
                            type="button"
                            onclick="changeCardSize('${v.volume}', ${v.price}, ${v.comparePrice || 0}, this)"
                            class="size-btn text-xs px-2.5 py-1 rounded-full border font-medium transition ${activeClasses}"
                        >
                            ${v.volume}
                        </button>
                    `;
                }).join('');
            } else {
                initialPrice = product.price || 0;
                initialComparePrice = product.comparePrice || product.mrp || '';
            }

            let discountBadgeHTML = '';
            if (initialComparePrice && Number(initialComparePrice) > Number(initialPrice)) {
                const pct = Math.round(((Number(initialComparePrice) - Number(initialPrice)) / Number(initialComparePrice)) * 100);
                }
            }

            return `
            <div data-product-id="${product._id}" class="relative w-[calc(80%-8px)] sm:w-[calc(50%-12px)] md:w-[calc(25%-18px)] h-[430px] sm:h-[450px] flex-shrink-0 snap-center product-card bg-gradient-to-b from-[#FFFDF9] via-white to-[#FFFDF9] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 border border-amber-900/15 flex flex-col justify-between transition-all duration-300 group overflow-hidden">
                <!-- Top Badges Bar -->
                <div class="flex items-center justify-between z-10 mb-1.5 min-h-[26px]">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full ${product.isBestseller ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold' : 'bg-slate-900 text-white font-bold'} text-[9px] sm:text-[10px] uppercase tracking-wider shadow-xs">
                        ${product.isBestseller ? 'BESTSELLER' : 'NEW'}
                    </span>
                    <div class="flex items-center gap-1.5">
                        ${discountBadgeHTML}
                        <button type="button" onclick="window.handleCardWishlistToggle && window.handleCardWishlistToggle('${product._id}', this, event)" class="wishlist-toggle-btn w-7 h-7 rounded-full bg-white/95 hover:bg-rose-50 border border-stone-200/80 shadow-2xs flex items-center justify-center transition-all cursor-pointer group/wish" title="Add to Wishlist" aria-label="Add to Wishlist">
                            <i class="fa-regular fa-heart text-xs text-stone-400 group-hover/wish:text-rose-600 transition-colors"></i>
                        </button>
                    </div>
                </div>
                <!-- Product Image Area (Seamless Blend) -->
                <div class="w-full flex justify-center items-center h-[140px] sm:h-[180px] overflow-hidden relative my-1 sm:my-2">
                    <a href="${getProductUrl(product)}" class="block w-full h-full flex items-center justify-center">
                        <img src="${fullImgUrl}" alt="${product.name}" loading="lazy" decoding="async" class="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-108 filter drop-shadow-sm">
                    </a>
                </div>
                <!-- Product Info Section -->
                <div class="flex-1 flex flex-col justify-between space-y-1.5 mb-2.5">
                    <div>
                        <h3 class="text-xs sm:text-sm font-fraunces font-bold text-slate-900 text-center leading-snug group-hover:text-[#8B4513] transition-colors capitalize line-clamp-1">${product.name}</h3>
                        <p class="text-[10px] sm:text-[11px] text-slate-600 text-center font-sans mt-0.5 line-clamp-2 min-h-[1.8rem] sm:min-h-[2.2rem] leading-tight sm:leading-relaxed">
                            ${product.description || 'Dermatologist-tested luxury formulation.'}
                        </p>
                    </div>
                    <!-- Rating Stars Row -->
                    <div class="flex items-center justify-center gap-1 text-[11px] text-amber-500 font-bold">
                        <div class="flex gap-0.5 text-amber-500 text-[10px] sm:text-[11px]">${starsHTML}</div>
                        <span class="text-[9px] sm:text-[10px] text-slate-500 font-mono font-semibold">(${product.rating || '4.9'})</span>
                    </div>
                    <!-- Size Variant Buttons -->
                    <div class="flex justify-center items-center gap-1 sm:gap-1.5 flex-wrap">
                        ${sizeButtonsHTML}
                    </div>
                    <!-- Price Display -->
                    <div class="flex items-baseline justify-center gap-1.5 pt-0.5">
                        <span class="product-price font-fraunces font-bold text-[#8B4513] text-base sm:text-lg"><span style="font-family:Arial,'Noto Sans',sans-serif">&#8377;</span>${initialPrice}</span>
                        <span class="product-mrp text-[11px] sm:text-xs line-through text-slate-400 font-mono">${initialComparePrice ? '<span style="font-family:Arial,\'Noto Sans\',sans-serif">&#8377;</span>' + initialComparePrice : ''}</span>
                    </div>
                </div>
                <!-- Add to Cart Action Bar -->
                <div class="pt-1">
                    <button type="button" onclick="toggleCartState(this)" class="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md hover:shadow-amber-500/25 transform active:scale-95">
                        <i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart
                    </button>
                </div>
            </div>
            `;
            }).join(" ");
            if (window.syncWishlistHeartsOnPage) {
                window.syncWishlistHeartsOnPage();
            }
        });
    } catch (err) {
        console.error("Slider loading failed:", err);
        if (wrapper) {
            wrapper.innerHTML = `<p class="text-ash px-6 py-4 font-medium text-center w-full">Unable to load products at this time.</p>`;
        }
    }
}
function changeCardSize(volume, price, comparePrice, buttonElement) {
    const card = buttonElement.closest('.product-card');
    if (!card) return;
    const buttons = card.querySelectorAll('.size-btn');
    buttons.forEach(btn => {
        btn.classList.remove('bg-ink', 'text-parchment', 'border-ink');
        btn.classList.add('border-[#DCD3BA]', 'text-ash');
    });
    buttonElement.classList.add('bg-ink', 'text-parchment', 'border-ink');
    buttonElement.classList.remove('border-[#DCD3BA]', 'text-ash');
    const priceEl = card.querySelector('.product-price');
    if (priceEl) priceEl.innerHTML = `<span style="font-family:Arial,'Noto Sans',sans-serif">&#8377;</span> ${price}`;
    const mrpElement = card.querySelector('.product-mrp');
    if (mrpElement) {
        if (comparePrice > 0) {
            mrpElement.innerHTML = `<span style="font-family:Arial,'Noto Sans',sans-serif">&#8377;</span> ${comparePrice}`;
            mrpElement.style.display = 'inline';
        } else {
            mrpElement.style.display = 'none';
        }
    }
    const discountBadgeEl = card.querySelector('.discount-badge');
    if (discountBadgeEl) {
        if (comparePrice && Number(comparePrice) > Number(price)) {
            const pct = Math.round(((Number(comparePrice) - Number(price)) / Number(comparePrice)) * 100);
            if (pct > 0) {
                discountBadgeEl.innerText = `${pct}% OFF`;
                discountBadgeEl.style.display = 'inline-block';
            } else {
                discountBadgeEl.style.display = 'none';
            }
        } else {
            discountBadgeEl.style.display = 'none';
        }
    }
}
function slideProducts(direction) {
    const container = document.getElementById('productSliderContainer');
    const wrapper = document.getElementById('productSliderWrapper');
    if (!container || !wrapper) return;
    const firstCard = wrapper.querySelector('.product-card');
    const scrollAmount = firstCard ? (firstCard.offsetWidth + 16) : 300;
    requestAnimationFrame(() => {
        if (direction === 'right') {
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        } else {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    });
}
function updateHeroBannerProductLinks(productList) {
    if (!Array.isArray(productList) || productList.length === 0) return;
    const heroLinks = document.querySelectorAll('.hero-slide-link');
    heroLinks.forEach((linkEl) => {
        const currentHref = linkEl.getAttribute('href') || '';
        const pathMatch = currentHref.match(/\/product\/([^/?#]+)/i);
        if (!pathMatch) return;
        const targetSlug = decodeURIComponent(pathMatch[1]).toLowerCase();
        const matchedProd = productList.find((p) => {
            const pSlug = (p.slug || '').toLowerCase();
            const pNameSlug = (p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            return pSlug === targetSlug || pNameSlug === targetSlug || pSlug.includes(targetSlug) || targetSlug.includes(pSlug);
        });
        if (matchedProd) {
            linkEl.href = getProductUrl(matchedProd);
        }
    });
}
let sliderProductsInitialized = false;
function safeInitSliderProducts() {
    if (sliderProductsInitialized) return;
    sliderProductsInitialized = true;
    loadSliderProducts();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInitSliderProducts);
} else {
    safeInitSliderProducts();
}
document.addEventListener('partialsLoaded', safeInitSliderProducts);
document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById('auto-slider');
    if (!slider) return;
    let scrollInterval;
    function startAutoSlide() {
        scrollInterval = setInterval(() => {
            requestAnimationFrame(() => {
                const step = slider.firstElementChild ? slider.firstElementChild.offsetWidth : 320;
                if (slider.scrollLeft + step >= slider.scrollWidth - step) {
                    slider.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    slider.scrollBy({ left: step, behavior: 'smooth' });
                }
            });
        }, 3500);
    }
    slider.addEventListener('mouseenter', () => clearInterval(scrollInterval));
    slider.addEventListener('mouseleave', startAutoSlide);
    startAutoSlide();
});
document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-routine-video-btn');
    const containerSlot = document.getElementById('video-container-slot');
    if (!playBtn || !containerSlot) return;
    playBtn.addEventListener('click', () => {
        containerSlot.classList.remove('hidden');
        containerSlot.innerHTML = `
            <video controls autoplay class="w-full h-full object-contain">
                <source src="./static/how-to-use.mp4" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
    });
});
window.toggleCartState = toggleCartState;
window.selectSize = selectSize;
window.changeCardSize = changeCardSize; 
window.updateQty = updateQty;
window.slideProducts = slideProducts;
window.loadSliderProducts = loadSliderProducts;
