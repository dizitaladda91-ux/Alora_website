import BASE_URL, { getImageUrl, safeFetchJson, getProductUrl } from "./config.js";

document.addEventListener("partialsLoaded", () => {

    // ---------- Mobile menu ----------
    const menuBtn = document.getElementById("menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuBtn && mobileMenu) {
        const menuIcon = menuBtn.querySelector("i");
        menuBtn.addEventListener("click", () => {
            mobileMenu.classList.toggle("hidden");
            if (menuIcon) {
                if (mobileMenu.classList.contains("hidden")) {
                    menuIcon.classList.replace("fa-xmark", "fa-bars");
                } else {
                    menuIcon.classList.replace("fa-bars", "fa-xmark");
                }
            }
        });
    }

    // Mobile dropdown menu guard
    const mobileDropdownBtn = document.getElementById("mobile-dropdown-btn");
    const mobileDropdownMenu = document.getElementById("mobile-dropdown-menu");
    if (mobileDropdownBtn && mobileDropdownMenu) {
        const dropdownIcon = mobileDropdownBtn.querySelector("i");
        mobileDropdownBtn.addEventListener("click", () => {
            mobileDropdownMenu.classList.toggle("hidden");
            if (dropdownIcon) dropdownIcon.classList.toggle("rotate-180");
        });
    }

    // ---------- Cart badge ----------
    updateHeaderCartCount();
});


/* ============================================================
   PAGE-SPECIFIC SCRIPTS (Independent Blocks)
   ============================================================ */

// ---------- Discount popup ----------
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('discountPopup');
    const popupBox = document.getElementById('popupBox');
    const closePopupBtn = document.getElementById('closePopup');
    const claimBtn = document.getElementById('claimBtn');

    if (!popup || !popupBox) return;

    // Helper function safe localStorage saving ke liye
    function setSeen() {
        try {
            localStorage.setItem('hasSeenDiscountPopup', 'true');
            console.log("Saved to localStorage successfully!");
        } catch (e) {
            console.error("LocalStorage write error:", e);
        }
    }

    // Check karo pehle se dikhaya gaya hai ya nahi
    let hasSeenPopup = false;
    try {
        hasSeenPopup = localStorage.getItem('hasSeenDiscountPopup') === 'true';
    } catch (e) {
        console.error("LocalStorage read error:", e);
    }

    // Agar user dekh chuka hai toh execution ROK DO
    if (hasSeenPopup) {
        return;
    }

    // PAGE LOAD HOTE HI FLAG SAVE KAR DO
    // (User ke button click karne ka wait mat karo taaki refresh/redirect par popup na aaye)
    setSeen();

    // Popup show karne ka timer
    setTimeout(() => {
        popup.style.display = 'flex';
        popup.classList.remove('opacity-0', 'pointer-events-none');
        popupBox.classList.remove('scale-95');
        popup.classList.add('opacity-100', 'pointer-events-auto');
        popupBox.classList.add('scale-100');
    }, 600);

    function hidePopup() {
        popup.classList.remove('opacity-100', 'pointer-events-auto');
        popupBox.classList.remove('scale-100');
        popup.classList.add('opacity-0', 'pointer-events-none');
        popupBox.classList.add('scale-95');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
        setSeen(); // Safety backup
    }

    if (closePopupBtn) closePopupBtn.addEventListener('click', hidePopup);
    if (claimBtn) claimBtn.addEventListener('click', hidePopup);

    popup.addEventListener('click', (e) => {
        if (e.target === popup) hidePopup();
    });
});

// ---------- Tree counter (green initiative) ----------
document.addEventListener("DOMContentLoaded", () => {
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
                cancelAnimationFrame(animationFrameId);
                setTimeout(() => startCounting(), 300);
            } else {
                sectionElement.classList.remove("opacity-100", "translate-y-0");
                sectionElement.classList.add("opacity-0", "translate-y-10");
                cancelAnimationFrame(animationFrameId);
                counterElement.innerText = "0+";
            }
        });
    }, { threshold: 0.2 });

    observer.observe(sectionElement);
});

// ---------- Testimonial slider ----------
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

// ---------- Hero banner slider ----------
document.addEventListener("DOMContentLoaded", () => {
    const track = document.getElementById("slider-track");
    if (!track) return;

    const nextBtn = document.getElementById("next-btn");
    const prevBtn = document.getElementById("prev-btn");
    const slides = track.children;
    const totalSlides = slides.length;
    const sliderContainer = track.parentElement;
    let currentIndex = 0;
    let autoInterval;

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

    const startAutoSlide = () => {
        autoInterval = setInterval(() => { if (nextBtn) nextBtn.click(); }, 5000);
    };
    const stopAutoSlide = () => clearInterval(autoInterval);

    sliderContainer.addEventListener("mouseenter", stopAutoSlide);
    sliderContainer.addEventListener("mouseleave", startAutoSlide);
    startAutoSlide();
});


/* ============================================================
   CART OPERATIONS & VARIANT CONTROL (Hybrid Compatible)
   ============================================================ */
function toggleCartState(button) {
    // Custom prototyping compatibility context read safely
    const card = button.closest('.product-card');
    if (!card) return;

    // Get active size details from variant setup
    const activeSizeBtn = card.querySelector('.size-btn.bg-ink') || card.querySelector('.size-btn');
    const sizeText = activeSizeBtn ? activeSizeBtn.innerText.trim() : 'Standard';

    // Retrieve unique primary key references
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

    // 1.2s Success state alert transition feedback
    const originalHTML = button.innerHTML;
    button.innerHTML = `<i class="fa-solid fa-circle-check text-xs"></i> Added to Cart`;
    button.disabled = true;

    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
    }, 1200);
}
function addToCart(id, name, price, img, qty = 1, size = 'Standard', mrp = 0) {
    let cart = JSON.parse(localStorage.getItem('glowCart')) || [];
    let existingProduct = cart.find(item => item.id === id);

    if (existingProduct) {
        existingProduct.qty += qty;
    } else {
        cart.push({ 
            id: id, 
            name: name, 
            price: price, 
            mrp: mrp || price, 
            img: img, 
            qty: qty, 
            size: size 
        });
    }

    localStorage.setItem('glowCart', JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    updateHeaderCartCount();
}

function updateHeaderCartCount() {
    let cart = JSON.parse(localStorage.getItem('glowCart')) || [];
    let totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
    
    // Updates both general selectors and explicit individual node indicators
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

    if (priceElement) priceElement.innerText = `₹ ${price}`;
    if (mrpElement) mrpElement.innerText = `₹ ${mrp}`;

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

    // Agar URL me search query hai (jaise home page se redirect hoke aaya ho)
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

// Product Filter Karne Ka Function
function filterProducts(query) {
    const productCards = document.querySelectorAll(".product-card"); // Check karein aapki product card class kya hai
    productCards.forEach(card => {
        const productNameElement = card.querySelector(".product-name"); // Check karein product name ki class kya hai
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


/* ============================================================
   BACKEND ENGINE CODE
   ============================================================ */

let currentScrollAmount = 0;

async function loadSliderProducts() {
    const wrapper = document.getElementById('productSliderWrapper');
    if (!wrapper) return;

    try {
        const products = await safeFetchJson(`${BASE_URL}/api/product/all`);

        const productList = Array.isArray(products) ? products : (products?.products || products?.data || []);
        const top5Products = productList.slice(0, 5);

        if (top5Products.length === 0) {
            wrapper.innerHTML = `<p class="text-ash px-6 py-4 font-medium text-center w-full">No active products found.</p>`;
            return;
        }

        wrapper.innerHTML = top5Products.map((product) => {
            const fullImgUrl = getImageUrl(product.imagepath, './static/placeholder.png');

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

            return `
            <div data-product-id="${product._id}" class="relative w-full sm:w-[calc(50%-12px)] md:w-[calc(25%-18px)] h-[460px] flex-shrink-0 product-card bg-white rounded-2xl shadow-sm border border-[#ECE4CE] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate__animated animate__fadeInUp overflow-hidden">

                <span class="absolute top-3 left-3 z-10 text-[9px] font-bold tracking-wider w-9 h-9 bg-black uppercase text-white rounded-full flex items-center justify-center shadow-md">
                    New
                </span>

                <div class="mx-4 mt-4 rounded-xl flex justify-center h-[180px] items-center overflow-hidden relative">
                    <a href="${getProductUrl(product)}" class="block w-full h-[180px]">
                        <img src="${fullImgUrl}" alt="${product.name}" class="w-full h-full object-contain transition-transform duration-300 hover:scale-110">
                    </a>
                </div>

                <div class="px-4 flex-1 flex flex-col justify-center">
                    <h3 class="text-base font-robot font-medium text-ink text-center leading-snug capitalize">${product.name}</h3>
                    <p class="text-xs text-ash text-center font-robot mt-1 px-2 line-clamp-2 min-h-[2rem]">
                         ${product.description || 'No description available'}
                    </p>

                    <div class="flex items-center justify-center gap-3 mt-3 flex-wrap">
                        <div class="flex gap-1.5 items-center">
                            ${sizeButtonsHTML}
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="product-price font-serif font-semibold text-ink text-lg">₹${initialPrice}</span>
                            <span class="product-mrp font-serif text-xs line-through text-ash opacity-70">${initialComparePrice ? '₹' + initialComparePrice : ''}</span>
                        </div>
                    </div>
                </div>

                <div class="px-4 mb-3">
                    <p class="text-[10px] font-bold text-ash uppercase tracking-[0.2em] mb-1 text-center">Quantity</p>
                    <div class="flex text-gold text-[11px] justify-center items-center gap-1 mb-2">
                        <span class="text-black text-xs font-medium">(5)</span>
                        <div class="flex text-[#D4AF37]">${starsHTML}</div>
                    </div>

                    <div class="flex items-center border border-[#DCD3BA] w-full rounded-lg overflow-hidden bg-white shadow-sm">
                        <button type="button" onclick="updateQty(-1, this)" class="w-11 h-8 bg-[#FAF7EE] text-ink hover:bg-[#F1EBD7] font-bold transition flex items-center justify-center select-none border-r border-[#DCD3BA]">−</button>
                        <input type="number" class="quantity flex-1 h-8 text-center font-semibold text-ink focus:outline-none text-sm min-w-0 bg-transparent" value="1" min="1" readonly>
                        <button type="button" onclick="updateQty(1, this)" class="w-11 h-8 bg-[#FAF7EE] text-ink hover:bg-[#F1EBD7] font-bold transition flex items-center justify-center select-none border-l border-[#DCD3BA]">+</button>
                    </div>
                </div>

                <button type="button" onclick="toggleCartState(this)" class="w-full bg-[#A0522D] hover:bg-[#8B4513] text-white py-3.5 font-semibold text-xs tracking-[0.15em] uppercase transition flex items-center justify-center gap-2 mt-auto">
                    <i class="fa-solid fa-cart-shopping text-xs"></i> Add to Cart
                </button>
            </div>
            `;
        }).join(" ");

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
    if (priceEl) priceEl.innerText = `₹ ${price}`;

    const mrpElement = card.querySelector('.product-mrp');
    if (mrpElement) {
        if (comparePrice > 0) {
            mrpElement.innerText = `₹ ${comparePrice}`;
            mrpElement.style.display = 'inline';
        } else {
            mrpElement.style.display = 'none';
        }
    }
}

function slideProducts(direction) {
    const wrapper = document.getElementById('productSliderWrapper');
    if (!wrapper) return;
    const firstCard = wrapper.querySelector('.product-card');
    if (!firstCard) return;

    const cardWidth = firstCard.offsetWidth;
    const gap = 24;
    const scrollStep = cardWidth + gap;
    const maxScroll = wrapper.scrollWidth - wrapper.parentElement.offsetWidth;

    if (direction === 'right') {
        currentScrollAmount += scrollStep;
        if (currentScrollAmount > maxScroll) {
            currentScrollAmount = 0;
        }
    } else if (direction === 'left') {
        currentScrollAmount -= scrollStep;
        if (currentScrollAmount < 0) {
            currentScrollAmount = maxScroll > 0 ? maxScroll : 0;
        }
    }

    wrapper.style.transform = `translateX(-${currentScrollAmount}px)`;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSliderProducts);
} else {
    loadSliderProducts();
}

document.addEventListener('partialsLoaded', loadSliderProducts);


// ---------- Auto Loop Multi-item Carousel Banner Engine ----------
document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById('auto-slider');
    if (!slider) return;

    let scrollInterval;

    function startAutoSlide() {
        scrollInterval = setInterval(() => {
            if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 5) {
                slider.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                slider.scrollBy({ left: slider.clientWidth, behavior: 'smooth' });
            }
        }, 3000);
    }

    slider.addEventListener('mouseenter', () => clearInterval(scrollInterval));
    slider.addEventListener('mouseleave', startAutoSlide);

    startAutoSlide();
});

/* ============================================================
   LAZY VIDEO PLAYER FACADE (Zero Initial Load Impact)
   ============================================================ */
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

/* ============================================================
   GLOBAL SCOPE EXPOSURE FOR COMPATIBILITY
   ============================================================ */
window.toggleCartState = toggleCartState;
window.selectSize = selectSize;
window.changeCardSize = changeCardSize; 
window.updateQty = updateQty;
window.slideProducts = slideProducts;
window.loadSliderProducts = loadSliderProducts;
