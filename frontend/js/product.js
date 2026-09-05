import BASE_URL, { getImageUrl, getProductUrl } from "./config.js";
import "./toast.js";
import "./wishlist.js";
let currentProductData = null;
let currentSelectedVariant = null;
function setPurchaseAvailability() {
    const cartButton = document.getElementById('cart-toggle-btn');
    // The catalogue is currently unlimited; availability/quantity checks are
    // intentionally performed only when inventory tracking is introduced.
    const available = Boolean(currentSelectedVariant);
    if (!cartButton) return;
    cartButton.disabled = !available;
    cartButton.classList.toggle('opacity-50', !available);
    cartButton.classList.toggle('cursor-not-allowed', !available);
    cartButton.innerHTML = available ? '<i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart' : '<i class="fa-solid fa-ban text-xs"></i> Out of Stock';
}
const PRIMARY_CART_KEY = "glowRitualCartData";
const REVIEWS_API_URL = `${BASE_URL}/api/reviews`;
function isUserLoggedIn() {
    // Check if user data exists in storage (auth token is in httpOnly cookie)
    return !!(localStorage.getItem('user') || sessionStorage.getItem('user'));
}
document.addEventListener('DOMContentLoaded', () => {
    loadProductDetails();
    const cartBtn = document.getElementById('cart-toggle-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            handleCartButtonClick(e.currentTarget);
        });
    }
    const wishBtn = document.getElementById('single-wishlist-btn');
    if (wishBtn) {
        wishBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentProductData?._id && window.handleCardWishlistToggle) {
                window.handleCardWishlistToggle(currentProductData._id, wishBtn, e);
            }
        });
    }
    const qtyMinusBtn = document.getElementById('qty-minus');
    const qtyPlusBtn = document.getElementById('qty-plus');
    if (qtyMinusBtn) qtyMinusBtn.addEventListener('click', () => updateQty(-1));
    if (qtyPlusBtn) qtyPlusBtn.addEventListener('click', () => updateQty(1));
    initReviewsFeature();
});
async function loadProductDetails() {
    const urlParams = new URLSearchParams(window.location.search);
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
        currentProductData = product; 
        if (!pathMatch) window.history.replaceState({}, "", getProductUrl(product));
        console.log("Fetched Product Data:", product);

        // Sync wishlist button status for single product
        const wishBtn = document.getElementById('single-wishlist-btn');
        if (wishBtn && product._id && window.syncWishlistHeartsOnPage) {
            wishBtn.closest = () => ({ getAttribute: () => product._id, querySelector: () => wishBtn });
            window.syncWishlistHeartsOnPage();
        }
        // Setup Media Carousel & Thumbnails
        const mediaContainer = document.getElementById('main-media-container') || document.querySelector('.imagesection');
        const thumbnailsContainer = document.getElementById('thumbnails-container');
        const prevMediaBtn = document.getElementById('prev-media-btn');
        const nextMediaBtn = document.getElementById('next-media-btn');

        const mediaList = [];
        const galleryImgs = [product.imagepath, ...(product.galleryImages || [])].filter(Boolean);
        galleryImgs.forEach(img => {
            mediaList.push({
                type: 'image',
                url: getImageUrl(img, "/static/placeholder.png")
            });
        });

        if (product.videoUrl && String(product.videoUrl).trim()) {
            const rawVid = product.videoUrl.trim();
            let posterUrl = '';
            const ytMatch = rawVid.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
            if (ytMatch) {
                posterUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            } else if (rawVid.includes('cloudinary.com')) {
                posterUrl = rawVid.replace(/\.(mp4|webm|mov|mkv)$/i, '.jpg');
            }
            mediaList.push({
                type: 'video',
                url: rawVid,
                poster: posterUrl
            });
        }

        let currentMediaIndex = 0;

        function updateActiveThumbnail() {
            if (!thumbnailsContainer) return;
            const buttons = thumbnailsContainer.querySelectorAll('button');
            buttons.forEach((btn, idx) => {
                if (idx === currentMediaIndex) {
                    btn.className = 'w-16 h-16 rounded-xl border-2 border-amber-600 shadow-md ring-2 ring-amber-500/30 overflow-hidden bg-white shrink-0 transition-all scale-105 relative group cursor-pointer';
                    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    btn.className = 'w-16 h-16 rounded-xl border border-[#E7DFC7] hover:border-amber-500/80 overflow-hidden bg-white shrink-0 transition-all opacity-80 hover:opacity-100 relative group cursor-pointer';
                }
            });
        }

        function showMediaByIndex(index) {
            if (!mediaList.length || !mediaContainer) return;
            currentMediaIndex = (index + mediaList.length) % mediaList.length;
            const item = mediaList[currentMediaIndex];

            if (item.type === 'image') {
                mediaContainer.innerHTML = `<img id="main-product-image" src="${item.url}" alt="${product.name || 'Product Image'}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.onerror=null; this.src='/static/placeholder.png'">`;
            } else if (item.type === 'video') {
                const vidUrl = item.url;
                if (vidUrl.includes('youtube.com') || vidUrl.includes('youtu.be')) {
                    let embedUrl = vidUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
                    mediaContainer.innerHTML = `<iframe src="${embedUrl}?autoplay=1" class="w-full h-full rounded-2xl md:rounded-3xl border-0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
                } else {
                    const fullVideoUrl = getImageUrl(vidUrl, '');
                    mediaContainer.innerHTML = `<video controls autoplay class="w-full h-full object-cover rounded-2xl md:rounded-3xl bg-black shadow-inner"><source src="${fullVideoUrl}" type="video/mp4">Your browser does not support video playback.</video>`;
                }
            }

            updateActiveThumbnail();
        }

        // Initialize First Media
        showMediaByIndex(0);

        // Render Thumbnails
        if (thumbnailsContainer && mediaList.length > 0) {
            thumbnailsContainer.innerHTML = mediaList.map((item, idx) => {
                if (item.type === 'image') {
                    return `
                        <button type="button" aria-label="View Image ${idx + 1}" class="w-16 h-16 rounded-xl border ${idx === 0 ? 'border-2 border-amber-600 shadow-md ring-2 ring-amber-500/30' : 'border-[#E7DFC7]'} overflow-hidden bg-white shrink-0 transition-all cursor-pointer hover:border-amber-500/80 relative" onclick="window.selectMediaIndex(${idx})">
                            <img src="${item.url}" alt="${product.name || 'Product'} image ${idx + 1}" loading="lazy" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/static/placeholder.png'">
                        </button>
                    `;
                } else {
                    // Video Thumbnail with Snapshot & Play Icon Overlay
                    const poster = item.poster || '';
                    return `
                        <button type="button" aria-label="Play Product Video" class="w-16 h-16 rounded-xl border ${idx === 0 ? 'border-2 border-amber-600 shadow-md ring-2 ring-amber-500/30' : 'border-[#E7DFC7]'} overflow-hidden bg-slate-900 shrink-0 transition-all cursor-pointer hover:border-amber-500/80 relative group" onclick="window.selectMediaIndex(${idx})" title="Play Product Video">
                            ${poster ? `<img src="${poster}" alt="Video preview" class="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition">` : `<video src="${getImageUrl(item.url, '')}#t=0.5" preload="metadata" class="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition"></video>`}
                            <div class="absolute inset-0 bg-black/25 flex items-center justify-center group-hover:bg-black/10 transition">
                                <div class="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
                                    <i class="fa-solid fa-play text-[11px] ml-0.5"></i>
                                </div>
                            </div>
                        </button>
                    `;
                }
            }).join('');
        }

        // Configure Navigation Arrows
        if (prevMediaBtn && nextMediaBtn) {
            if (mediaList.length > 1) {
                prevMediaBtn.classList.remove('hidden');
                nextMediaBtn.classList.remove('hidden');
                prevMediaBtn.onclick = (e) => { e.preventDefault(); showMediaByIndex(currentMediaIndex - 1); };
                nextMediaBtn.onclick = (e) => { e.preventDefault(); showMediaByIndex(currentMediaIndex + 1); };
            } else {
                prevMediaBtn.classList.add('hidden');
                nextMediaBtn.classList.add('hidden');
            }
        }

        // Mobile Touch Swipe Navigation (Seamless Finger Swiping on Mobile & Tablets)
        if (mediaContainer) {
            let touchStartX = 0;
            let touchEndX = 0;
            mediaContainer.addEventListener('touchstart', (e) => {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    touchStartX = e.changedTouches[0].screenX;
                }
            }, { passive: true });

            mediaContainer.addEventListener('touchend', (e) => {
                if (e.changedTouches && e.changedTouches.length > 0) {
                    touchEndX = e.changedTouches[0].screenX;
                    const diff = touchEndX - touchStartX;
                    if (Math.abs(diff) > 40) {
                        if (diff < 0) {
                            showMediaByIndex(currentMediaIndex + 1); // Swiped Left -> Next
                        } else {
                            showMediaByIndex(currentMediaIndex - 1); // Swiped Right -> Prev
                        }
                    }
                }
            }, { passive: true });
        }

        window.selectMediaIndex = function(idx) {
            showMediaByIndex(idx);
        };
        window.selectGalleryImage = function(imgUrl) {
            const foundIdx = mediaList.findIndex(m => m.type === 'image' && m.url === imgUrl);
            showMediaByIndex(foundIdx !== -1 ? foundIdx : 0);
        };
        window.selectGalleryVideo = function(videoUrl) {
            const foundIdx = mediaList.findIndex(m => m.type === 'video');
            showMediaByIndex(foundIdx !== -1 ? foundIdx : 0);
        };
        const titleEl = document.getElementById('product-title');
        if (titleEl) titleEl.innerText = product.name || "No Title Available";
        const descEl = document.getElementById('product-desc');
        if (descEl) descEl.innerText = product.description || 'No description available.';
        document.title = product.metaTitle || product.name || 'Alora Radiance';
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription && product.metaDescription) metaDescription.setAttribute('content', product.metaDescription);
        const detailsEl = document.getElementById('product-details');
        if (detailsEl) detailsEl.innerText = product.details || product.description || "Details not available.";
        const benefitsEl = document.getElementById('product-benefits');
        if (benefitsEl) benefitsEl.innerText = product.benefits || 'Benefits information is not available.';
        const usageEl = document.getElementById('product-usage');
        if (usageEl) usageEl.innerText = product.usageInstructions || 'Usage instructions are not available.';
        const ingredientsEl = document.getElementById('product-ingredients');
        if (ingredientsEl) ingredientsEl.innerText = product.ingredients || "Ingredients info not specified.";
        const ratingCount = Math.round(product.rating || 4);
        const starsContainer = document.querySelector('.text-gold.text-sm');
        if (starsContainer) {
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                starsHTML += i <= ratingCount ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-regular fa-star text-[#D9D2BC]"></i>`;
            }
            starsContainer.innerHTML = starsHTML;
        }
        const priceEl = document.getElementById('product-price');
        const mrpEl = document.getElementById('product-mrp');
        const variantsContainer = document.getElementById('variants-container');
        if (product.variants && product.variants.length > 0) {
            currentSelectedVariant = product.variants[0];
            if (priceEl) priceEl.innerText = `₹ ${currentSelectedVariant.price}`;
            if (mrpEl) mrpEl.innerText = currentSelectedVariant.comparePrice ? `₹ ${currentSelectedVariant.comparePrice}` : '';
            if (variantsContainer) {
                variantsContainer.innerHTML = product.variants.map((v) => {
                    const inStock = true;
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
            currentSelectedVariant = {
                volume: 'Standard',
                price: product.price || 0,
                comparePrice: product.comparePrice || 0,
                stock: product.stock ?? 999
            };
            if (priceEl) priceEl.innerText = `₹ ${product.price || 0}`;
            if (mrpEl) mrpEl.innerText = product.comparePrice ? `₹ ${product.comparePrice}` : '';
            if (variantsContainer) variantsContainer.innerHTML = `<p class="text-xs text-ash">No variants available</p>`;
        }
        setPurchaseAvailability();
        renderGoodToKnowFaqs(product);
        fetchAndRenderReviews(productId);
    } catch (error) {
        console.error("Error loading product details:", error);
    }
}
window.selectSize = function(volume, price, comparePrice, stock, buttonElement) {
    if (!buttonElement) return;
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
    let cart = [];
    try {
        const currentCart = JSON.parse(localStorage.getItem("glowCart") || 'null');
        const legacyCart = JSON.parse(localStorage.getItem(PRIMARY_CART_KEY) || 'null');
        cart = Array.isArray(currentCart) ? currentCart : (Array.isArray(legacyCart) ? legacyCart : []);
    } catch (error) {
        console.warn('Invalid saved cart data was reset before adding an item.', error);
    }
    const productId = currentProductData._id || currentProductData.id;
    const targetVolumeText = currentSelectedVariant.volume || "Standard";
    const compositeCartUniqueIdKeyString = `${productId}__${targetVolumeText}`;
    const targetProductImageSrc = getImageUrl(currentProductData.imagepath, "/static/placeholder.png");
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
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Added!`;
    btnElement.disabled = true;
    setTimeout(() => {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
        if (qtyInput) qtyInput.value = 1;
        window.location.href = "/cart.html";
    }, 1200);
}
function updateQty(change) {
    const qtyInput = document.getElementById('quantity');
    if (!qtyInput) return;
    let currentQty = parseInt(qtyInput.value) || 1;
    currentQty += change;
    if (currentQty < 1) currentQty = 1;
    qtyInput.value = currentQty;
}
function getProductIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || 'alora-radiance-serum';
}
function initReviewsFeature() {
    const starButtons = document.querySelectorAll('.star-btn');
    const ratingInput = document.getElementById('review-rating-value');
    const reviewForm = document.getElementById('review-form');
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
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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
                    reviewForm.reset();
                    if (ratingInput) ratingInput.value = 0;
                    starButtons.forEach(star => {
                        star.classList.remove('fa-solid');
                        star.classList.add('fa-regular');
                    });
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
            if (noReviewsMsg) {
                reviewsListContainer.appendChild(noReviewsMsg);
                noReviewsMsg.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error fetching/rendering reviews dataset:', error);
    }
}
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
