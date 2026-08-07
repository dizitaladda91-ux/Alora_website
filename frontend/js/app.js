import BASE_URL, { getImageUrl } from "./config.js";
const RUPEE_SYMBOL = '\u20B9';

// ==========================================
// 1. GLOBAL CUSTOM SUCCESS MODAL
// ==========================================
export function showSuccessModal(title, message, callback) {
    const existingModal = document.getElementById("custom-success-modal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "custom-success-modal";
    modal.className = "fixed inset-0 flex items-center justify-center z-[9999] bg-black/60 backdrop-blur-sm";
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gold/20 text-center">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
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

// ==========================================
// 2. DYNAMIC NAVBAR RENDERING FUNCTION
// ==========================================
export function renderNavbarState() {
    const authActions = document.getElementById("auth-actions");
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!authActions) {
        console.warn("Auth placeholder (#auth-actions) abhi DOM me nahi mila.");
        return;
    }

    if (storedUser && token) {
        try {
            const user = JSON.parse(storedUser);
            const displayName = user.name || "User";

            authActions.innerHTML = `
                <div class="flex items-center gap-3 text-sm font-medium text-black normal-case">
                    <span>Hi, <b class="text-[#2A2A24] font-bold uppercase">${displayName}</b></span>
                    <button id="logout-btn" class="bg-black hover:bg-orange-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-bold shadow-sm">
                        Logout
                    </button>
                </div>
            `;

            document.getElementById("logout-btn").addEventListener("click", () => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "./index.html";
            });

        } catch (err) {
            console.error("Localstorage data read error:", err);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    } else {
        authActions.innerHTML = `
            <a href="./login.html" class="text-base text-black hover:text-gold transition">
                <i class="fa-solid fa-user"></i>
            </a>
        `;
    }
}

// ==========================================
// 3. DYNAMIC SEARCH FUNCTIONALITY
// ==========================================
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
            fetchSuggestions(query, suggestionsBox);
        }, 300);
    });

    document.addEventListener("click", (e) => {
        if (!searchContainer.contains(e.target) && !searchOpenBtn.contains(e.target)) {
            suggestionsBox.classList.add("hidden");
        }
    });
}

async function fetchSuggestions(query, suggestionsBox) {
    try {
        const response = await fetch(`${BASE_URL}/api/product/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error("Search API response error");
        
        const data = await response.json();
        const productsList = data.products || (Array.isArray(data) ? data : []);

        if (productsList.length === 0) {
            suggestionsBox.innerHTML = `<div class="p-4 text-xs text-stone-500 text-center font-medium">No products found for "<i>${query}</i>"</div>`;
            suggestionsBox.classList.remove("hidden");
            return;
        }

        suggestionsBox.innerHTML = productsList.map(prod => {
            const imageSrc = getImageUrl(prod.imagepath, './static/placeholder.png');
            const rawPrice = (prod.variants && prod.variants.length > 0 && prod.variants[0] && prod.variants[0].price != null)
                ? prod.variants[0].price
                : (prod.price ?? prod.discountprice ?? prod.productPrice ?? 'N/A');
            const cleanedPrice = (rawPrice === 'N/A' || rawPrice == null) ? '' : String(rawPrice).replace(/[^\d.]/g, '').trim();
            const displayPrice = cleanedPrice ? `${RUPEE_SYMBOL} ${cleanedPrice}` : '';

            return `
                <div onclick="window.location.href='./product.html?id=${prod._id}'" class="flex items-center gap-3 p-3 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-b-0 transition text-left">
                    <img src="${imageSrc}" alt="${prod.name || 'Product'}" class="w-10 h-10 object-contain rounded bg-stone-50 border border-stone-200" onerror="this.src='./static/placeholder.png'">
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

// ==========================================
// 4. LISTENERS AND LIFECYCLE
// ==========================================
function setupAppLifecycle() {
    renderNavbarState();
    initSearchFunctionality();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAppLifecycle);
} else {
    setupAppLifecycle();
}

document.addEventListener("partialsLoaded", () => {
    setupAppLifecycle();
});

// partialsLoaded event ke baad hi renderNavbarState/initSearch chalega (see listener above)
// Note: setTimeout fallback hataya gaya tha — navbar partial load hone se pehle #auth-actions DOM me nahi hota

// Global query form handler
document.addEventListener("submit", async (e) => {
    if (e.target && e.target.id === "contactForm") {
        e.preventDefault();
        const form = e.target;
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const message = document.getElementById("message").value;

        try {
            const response = await fetch(`${BASE_URL}/api/queries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message })
            });

            const data = await response.json();
            if (response.ok) {
                form.reset();
                showSuccessModal("Weldone!", "Aapki query hume mil chuki hai. Hum jald aapse connect karenge.");
            } else {
                alert("Error: " + (data.message || "Something went wrong"));
            }
        } catch (error) {
            console.error("Query Submit Error:", error);
            alert("Server connected nahi hai.");
        }
    }
});