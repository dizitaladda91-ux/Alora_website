import BASE_URL, { getImageUrl, getProductUrl } from "./config.js";
import "./toast.js";

// Global variables current selection store karne ke liye
let currentProductData = null;
let currentSelectedVariant = null;

function setPurchaseAvailability() {
    const cartButton = document.getElementById('cart-toggle-btn');
    const stock = Number(currentSelectedVariant?.stock || 0);
    const available = Boolean(currentProductData?.isAvailable) && stock > 0;
    if (!cartButton) return;
    cartButton.disabled = !available;
    cartButton.classList.toggle('opacity-50', !available);
    cartButton.classList.toggle('cursor-not-allowed', !available);
    cartButton.innerHTML = available ? '<i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart' : '<i class="fa-solid fa-ban text-xs"></i> Out of Stock';
}

// Unified Cart Storage Key
const PRIMARY_CART_KEY = "glowRitualCartData";

// Review API Endpoint Configuration
const REVIEWS_API_URL = `${BASE_URL}/api/reviews`;

// Helper: Check if user is logged in
function isUserLoggedIn() {
    return !!getAuthToken();
}

// Helper: Get stored Auth Token or Session
function getAuthToken() {
    // 1. Direct token check (userToken ya token key)
    let token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (token) return token;

    // 2. Fallback: LocalStorage mein 'user' object check karein
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const userData = JSON.parse(userStr);
            // Token return karein agar object mein hai, ya Fallback identifier
            return userData.token || userData.jwt || userData._id || userData.email || 'active-session';
        } catch (e) {
            console.error("User data parse karne mein error:", e);
        }
    }

    return '';
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Product Data Load Karein
    loadProductDetails();

    // 2. Add To Cart Button Par Modern Event Listener Lagayein
    const cartBtn = document.getElementById('cart-toggle-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            handleCartButtonClick(e.currentTarget);
        });
    }

    // 3. Quantity Buttons Par Event Listeners Lagayein
    const qtyMinusBtn = document.getElementById('qty-minus');
    const qtyPlusBtn = document.getElementById('qty-plus');
    
    if (qtyMinusBtn) qtyMinusBtn.addEventListener('click', () => updateQty(-1));
    if (qtyPlusBtn) qtyPlusBtn.addEventListener('click', () => updateQty(1));

    // 4. Reviews Feature Key Component Wireframes Initialize Karein
    initReviewsFeature();
});

async function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    // Public URL is /product/<product-name>; old ?id= links stay compatible.
    const pathMatch = window.location.pathname.match(/^\/product\/([^/?#]+)\/?$/i);
    const productId = pathMatch ? decodeURIComponent(pathMatch[1]) : urlParams.get('id');

    if (!productId) {
        console.error("Product ID URL mein nahi mili.");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/product/${productId}`);
        const product = await response.json();

        if (!response.ok) throw new Error(product.error || "Product fetch nahi ho paya");

        // Global state update
        currentProductData = product; 
        if (!pathMatch) window.history.replaceState({}, "", getProductUrl(product));
        console.log("Fetched Product Data:", product);

        // --- UI Updates ---
        const mainImg = document.getElementById('main-product-image');
        if (mainImg) {
            mainImg.onerror = function() {
                this.onerror = null;
                this.src = './static/placeholder.png';
            };
            mainImg.src = getImageUrl(product.imagepath, "./static/placeholder.png");
            mainImg.alt = product.name || "Product Image";
        }

        const thumbnailsContainer = document.getElementById('thumbnails-container');
        if (thumbnailsContainer) {
            const gallery = [product.imagepath, ...(product.galleryImages || [])].filter(Boolean);
            let thumbnailsHTML = gallery.map((imagePath, index) => `
                <button type="button" class="w-16 h-16 rounded-lg border ${index === 0 ? 'border-clay' : 'border-[#E7DFC7]'} overflow-hidden bg-white hover:border-amber-500 transition" onclick="window.selectGalleryImage('${getImageUrl(imagePath, './static/placeholder.png')}')">
                    <img src="${getImageUrl(imagePath, './static/placeholder.png')}" alt="${product.name || 'Product'} image ${index + 1}" loading="lazy" class="w-full h-full object-contain p-1" onerror="this.onerror=null; this.src='./static/placeholder.png'">
                </button>`).join('');

            if (product.videoUrl && String(product.videoUrl).trim()) {
                thumbnailsHTML += `
                <button type="button" class="w-16 h-16 rounded-lg border border-amber-500 overflow-hidden bg-slate-900 text-white flex flex-col items-center justify-center hover:scale-105 transition relative group" onclick="window.selectGalleryVideo('${product.videoUrl}')" title="Play Product Video">
                    <i class="fa-solid fa-play text-amber-400 text-lg"></i>
                    <span class="text-[9px] font-bold uppercase tracking-wider text-amber-200 mt-0.5 font-mono">Video</span>
                </button>`;
            }

            thumbnailsContainer.innerHTML = thumbnailsHTML;
        }

window.selectGalleryImage = function(imgUrl) {
    const mediaContainer = document.getElementById('main-media-container') || document.querySelector('.imagesection');
    if (!mediaContainer) return;
    mediaContainer.innerHTML = `<img id="main-product-image" src="${imgUrl}" alt="Product Image" class="h-full w-auto object-contain transition-transform duration-300 hover:scale-105" onerror="this.onerror=null; this.src='./static/placeholder.png'">`;
};

window.selectGalleryVideo = function(videoUrl) {
    const mediaContainer = document.getElementById('main-media-container') || document.querySelector('.imagesection');
    if (!mediaContainer) return;
    
    let fullVideoUrl = getImageUrl(videoUrl, '');
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let embedUrl = videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
        mediaContainer.innerHTML = `<iframe src="${embedUrl}?autoplay=1" class="w-full h-full rounded-2xl border-0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
        mediaContainer.innerHTML = `<video controls autoplay class="w-full h-full object-contain rounded-2xl bg-black"><source src="${fullVideoUrl}" type="video/mp4">Your browser does not support video playback.</video>`;
    }
};

        const titleEl = document.getElementById('product-title');
        if (titleEl) titleEl.innerText = product.name || "No Title Available";

        const descEl = document.getElementById('product-desc');
        if (descEl) descEl.innerText = product.description || 'No description available.';

        document.title = product.metaTitle || product.name || 'Alora Radiance';
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription && product.metaDescription) metaDescription.setAttribute('content', product.metaDescription);

        // Details & Ingredients Tabs update
        const detailsEl = document.getElementById('product-details');
        if (detailsEl) detailsEl.innerText = product.details || product.description || "Details not available.";

        const benefitsEl = document.getElementById('product-benefits');
        if (benefitsEl) benefitsEl.innerText = product.benefits || 'Benefits information is not available.';

        const usageEl = document.getElementById('product-usage');
        if (usageEl) usageEl.innerText = product.usageInstructions || 'Usage instructions are not available.';

        const ingredientsEl = document.getElementById('product-ingredients');
        if (ingredientsEl) ingredientsEl.innerText = product.ingredients || "Ingredients info not specified.";

        // Ratings Logic
        const ratingCount = Math.round(product.rating || 4);
        const starsContainer = document.querySelector('.text-gold.text-sm');
        if (starsContainer) {
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                starsHTML += i <= ratingCount ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-regular fa-star text-[#D9D2BC]"></i>`;
            }
            starsContainer.innerHTML = starsHTML;
        }

        // --- Variants & Price Dynamic Configuration ---
        const priceEl = document.getElementById('product-price');
        const mrpEl = document.getElementById('product-mrp');
        const variantsContainer = document.getElementById('variants-container');

        if (product.variants && product.variants.length > 0) {
            // Default select first variant
            currentSelectedVariant = product.variants.find((variant) => Number(variant.stock) > 0) || product.variants[0];
            if (priceEl) priceEl.innerText = `₹ ${currentSelectedVariant.price}`;
            if (mrpEl) mrpEl.innerText = currentSelectedVariant.comparePrice ? `₹ ${currentSelectedVariant.comparePrice}` : '';

            if (variantsContainer) {
                variantsContainer.innerHTML = product.variants.map((v) => {
                    const inStock = product.isAvailable && Number(v.stock) > 0;
                    const isActive = v.volume === currentSelectedVariant.volume;
                    const activeClasses = isActive 
                        ? 'border-2 border-ink bg-ink text-parchment font-semibold' 
                        : 'border border-[#DCD3BA] text-ash font-semibold hover:border-ink';

                    return `
                        <button 
                            onclick="selectSize('${v.volume}', ${v.price}, ${v.comparePrice || 0}, ${v.stock || 0}, this)"
                            class="size-btn text-sm px-4 py-2 rounded-full transition ${inStock ? activeClasses : 'border border-gray-200 text-gray-400 line-through cursor-not-allowed'}"
                            ${inStock ? '' : 'disabled'}
                        >
                            ${v.volume}${inStock ? '' : ' (Out)'}
                        </button>
                    `;
                }).join('');
            }
        } else {
            // No variants simple fallback mapping
            currentSelectedVariant = {
                volume: 'Standard',
                price: product.price || 0,
                comparePrice: product.comparePrice || 0
            };
            if (priceEl) priceEl.innerText = `₹ ${product.price || 0}`;
            if (mrpEl) mrpEl.innerText = product.comparePrice ? `₹ ${product.comparePrice}` : '';
            if (variantsContainer) variantsContainer.innerHTML = `<p class="text-xs text-ash">No variants available</p>`;
        }

        setPurchaseAvailability();

        // Render Good To Know FAQs
        renderGoodToKnowFaqs(product);

        // Product data successfully loaded -> triggers runtime reviews fetch
        fetchAndRenderReviews(productId);

    } catch (error) {
        console.error("Error loading product details:", error);
    }
}

// Global scope window access attachment for inline dynamic variant buttons
window.selectSize = function(volume, price, comparePrice, stock, buttonElement) {
    if (!buttonElement) return;
    if (Number(stock) <= 0) return;

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.className = "size-btn text-sm px-4 py-2 rounded-full transition border border-[#DCD3BA] text-ash font-semibold hover:border-ink";
    });
    buttonElement.className = "size-btn text-sm px-4 py-2 rounded-full transition border-2 border-ink bg-ink text-parchment font-semibold";

    currentSelectedVariant = { volume, price, comparePrice, stock };

    const priceEl = document.getElementById('product-price');
    const mrpEl = document.getElementById('product-mrp');
    if (priceEl) priceEl.innerText = `₹ ${price}`;
    if (mrpEl) mrpEl.innerText = comparePrice ? `₹ ${comparePrice}` : '';
}

// Was previously defined inside the review-submit handler, so gallery
// thumbnails threw "selectGalleryImage is not a function" until a review had
// been submitted once. Moved to top-level so it's available as soon as the
// page loads and the thumbnail buttons are rendered.
window.selectGalleryImage = function(imageUrl) {
    const mainImage = document.getElementById('main-product-image');
    if (mainImage) mainImage.src = imageUrl;
};

function handleCartButtonClick(btnElement) {
    if (!currentProductData || !currentSelectedVariant) {
        window.showToast("Please wait for the product to load.", "warning");
        return;
    }

    const qtyInput = document.getElementById('quantity');
    const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

    if (!currentProductData.isAvailable || Number(currentSelectedVariant.stock) < quantity) {
        window.showToast("This selected variant is out of stock or has insufficient quantity.", "error");
        setPurchaseAvailability();
        return;
    }

    let cart = JSON.parse(localStorage.getItem("glowCart")) || JSON.parse(localStorage.getItem(PRIMARY_CART_KEY)) || [];

    const productId = currentProductData._id || currentProductData.id;
    const targetVolumeText = currentSelectedVariant.volume || "Standard";
    const compositeCartUniqueIdKeyString = `${productId}__${targetVolumeText}`;

    const targetProductImageSrc = getImageUrl(currentProductData.imagepath, "./static/placeholder.png");

    const existingItem = cart.find(item => item.id === compositeCartUniqueIdKeyString || item.uniqueCartItemKeyId === compositeCartUniqueIdKeyString);

    if (existingItem) {
        existingItem.qty = (existingItem.qty || existingItem.qtyCountOrderMetric || 0) + quantity;
        existingItem.qtyCountOrderMetric = existingItem.qty;
    } else {
        cart.push({
            id: compositeCartUniqueIdKeyString,
            uniqueCartItemKeyId: compositeCartUniqueIdKeyString,
            productId: productId,
            name: currentProductData.name,
            productName: currentProductData.name,
            productDescription: currentProductData.description || 'Luxury Formulation',
            size: targetVolumeText,
            activeSelectedSizeConfig: targetVolumeText,
            price: Number(currentSelectedVariant.price) || 0,
            unitPriceItemConfig: Number(currentSelectedVariant.price) || 0,
            mrp: Number(currentSelectedVariant.comparePrice) || Number(currentSelectedVariant.price) || 0,
            qty: quantity,
            qtyCountOrderMetric: quantity,
            img: targetProductImageSrc,
            baseImg: targetProductImageSrc
        });
    }

    localStorage.setItem("glowCart", JSON.stringify(cart));
    localStorage.setItem("glowRitualCartData", JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    console.log("Cart localstorage successfully synchronized:", cart);
    
    if (typeof window.updateHeaderCartCount === 'function') {
        window.updateHeaderCartCount();
    }

    const mainImgEl = document.getElementById("main-product-image");
    if (mainImgEl && typeof window.flyToCartAnimation === "function") {
        window.flyToCartAnimation(mainImgEl);
    }
    
    // UI Feedback state logic
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Added!`;
    btnElement.disabled = true;
    
    setTimeout(() => {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
        if (qtyInput) qtyInput.value = 1;
        window.location.href = "./cart.html";
    }, 1200);
}

function updateQty(change) {
    const qtyInput = document.getElementById('quantity');
    if (!qtyInput) return;
    let currentQty = parseInt(qtyInput.value) || 1;
    currentQty += change;
    if (currentQty < 1) currentQty = 1;
    const stock = Number(currentSelectedVariant?.stock || 0);
    if (stock > 0 && currentQty > stock) currentQty = stock;
    qtyInput.value = currentQty;
}

// ==========================================================================
// REVIEWS & RATINGS LOGIC HANDLERS
// ==========================================================================

function getProductIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || 'alora-radiance-serum';
}

function initReviewsFeature() {
    const starButtons = document.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('review-rating-value');
    const reviewForm = document.getElementById('review-form');

    // 1. Interactive Dynamic Star Click Actions Setup
    starButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedValue = parseInt(button.getAttribute('data-value'));
            if (ratingInput) ratingInput.value = selectedValue;

            starButtons.forEach(star => {
                const starValue = parseInt(star.getAttribute('data-value'));
                if (starValue <= selectedValue) {
                    star.classList.remove('fa-regular');
                    star.classList.add('fa-solid');
                } else {
                    star.classList.remove('fa-solid');
                    star.classList.add('fa-regular');
                }
            });
        });
    });

    // 2. Submit Review Form Pipeline Handler
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Authentication Guard Check
            if (!isUserLoggedIn()) {
                window.location.href = './login.html';
                return;
            }

            const usernameInput = document.getElementById('review-username');
            const commentInput = document.getElementById('review-comment');
            const ratingValue = parseInt(ratingInput ? ratingInput.value : 0);
            const productId = getProductIdFromURL();

            if (ratingValue === 0) {
                window.showToast("Please select at least 1 star rating before submitting.", "warning");
                return;
            }

            const reviewPayload = {
                productId: productId,
                username: usernameInput.value.trim(),
                rating: ratingValue,
                comment: commentInput.value.trim()
            };

            try {
                const token = getAuthToken();
                const response = await fetch(REVIEWS_API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(reviewPayload)
                });

                const result = await response.json();

                if (result.success) {
                    window.showToast("Review submitted successfully! Thank you.", "success");
                    
                    // Reset Form states back to base defaults
                    reviewForm.reset();
                    if (ratingInput) ratingInput.value = 0;
                    starButtons.forEach(star => {
                        star.classList.remove('fa-solid');
                        star.classList.add('fa-regular');
                    });

                    // Real-time render loop invocation to sync UI immediately
                    fetchAndRenderReviews(productId);
                } else {
                    window.showToast(`Failed to save review: ${result.message}`, "error");
                }
            } catch (error) {
                console.error('Error posting review payload:', error);
                window.showToast("Backend submission communication failure. Check your server logs.", "error");
            }
        });
    }
}

async function fetchAndRenderReviews(productId) {
    const reviewsListContainer = document.getElementById('reviews-list-container');
    const noReviewsMsg = document.getElementById('no-reviews-msg');

    if (!reviewsListContainer) return;

    try {
        const response = await fetch(`${REVIEWS_API_URL}/${productId}`);
        const result = await response.json();

        // Safe setup: Clear existing rendered list items except the main h3 element header
        const staticHeading = reviewsListContainer.querySelector('h3');
        reviewsListContainer.innerHTML = '';
        if (staticHeading) reviewsListContainer.appendChild(staticHeading);

        if (result.success && result.data && result.data.length > 0) {
            if (noReviewsMsg) noReviewsMsg.style.display = 'none';

            result.data.forEach(review => {
                const reviewElement = document.createElement('div');
                reviewElement.className = 'border-b border-[#FAF7EE] pb-4 mb-4 last:border-0';

                const reviewDate = new Date(review.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                let starsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    starsHTML += i <= review.rating 
                        ? '<i class="fa-solid fa-star mr-0.5"></i>' 
                        : '<i class="fa-regular fa-star mr-0.5"></i>';
                }

                reviewElement.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-medium text-ink text-sm">${escapeHTML(review.username)}</span>
                        <span class="text-xs text-ash">${reviewDate}</span>
                    </div>
                    <div class="flex text-gold text-xs mb-2">
                        ${starsHTML}
                    </div>
                    <p class="text-xs text-[#5C594E] leading-relaxed">${escapeHTML(review.comment)}</p>
                `;
                reviewsListContainer.appendChild(reviewElement);
            });
        } else {
            // Re-inject "No reviews yet" structure dynamically if collection array comes back empty
            if (noReviewsMsg) {
                reviewsListContainer.appendChild(noReviewsMsg);
                noReviewsMsg.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error fetching/rendering reviews dataset:', error);
    }
}

// XSS Vulnerability injection defense helper function
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function renderGoodToKnowFaqs(product) {
    const faqList = document.getElementById('product-faq-list');
    if (!faqList) return;

    let faqsToRender = Array.isArray(product?.faqs) && product.faqs.length > 0
        ? product.faqs
        : [
            {
                question: `Can I use the ${product?.name || 'Alora Radiance'} product every day?`,
                answer: "Yes! Our products are dermatologist-formulated to be gentle enough for daily use, morning and night, to remove impurities without stripping skin moisture."
            },
            {
                question: "Can I use the Face Serum every day?",
                answer: "Yes. Apply 3-4 drops daily after cleansing and before your face cream. If you are new to active Retinol, start with alternate nights."
            },
            {
                question: "When should I apply the Face Cream?",
                answer: "Apply the Face Cream right after your serum, morning and night, to lock in active ingredients and seal 24-hour hydration."
            },
            {
                question: "Can I use the Body Lotion every day?",
                answer: "Yes! Apply daily right after a bath/shower when skin is damp for maximum absorption and long-lasting velvety softness."
            },
            {
                question: "How often should I use the Face Scrub?",
                answer: "Use the Face Scrub 2–3 times a week to gently exfoliate dead skin cells, unclog pores, and restore skin smoothness."
            }
        ];

    faqList.innerHTML = faqsToRender.map((faq, index) => `
        <details class="group bg-white p-5 rounded-2xl border border-amber-900/15 shadow-xs transition-all duration-300 open:shadow-md" ${index === 0 ? 'open' : ''}>
            <summary class="flex justify-between items-center font-fraunces font-bold text-slate-900 text-sm sm:text-base cursor-pointer list-none select-none">
                <span>${escapeHTML(faq.question)}</span>
                <span class="w-8 h-8 rounded-full bg-amber-100 text-[#8B4513] flex items-center justify-center text-xs group-open:rotate-45 transition-transform"><i class="fa-solid fa-plus"></i></span>
            </summary>
            <p class="text-xs sm:text-sm text-slate-600 mt-3 pl-3 border-l-2 border-[#8B4513] leading-relaxed font-sans">
                ${escapeHTML(faq.answer)}
            </p>
        </details>
    `).join('');
}