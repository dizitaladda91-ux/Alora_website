document.addEventListener('DOMContentLoaded', () => {
    const searchOpenBtn = document.getElementById('search-open-btn');
    const searchCloseBtn = document.getElementById('search-close-btn');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const RUPEE_SYMBOL = '\u20B9';

    // 1. Toggle Search Bar
    if (searchOpenBtn && searchContainer) {
        searchOpenBtn.addEventListener('click', () => {
            searchContainer.classList.remove('hidden');
            searchInput.focus();
        });
    }

    if (searchCloseBtn && searchContainer) {
        searchCloseBtn.addEventListener('click', () => {
            searchContainer.classList.add('hidden');
            searchResults.classList.add('hidden');
            searchInput.value = '';
        });
    }

    // 2. Fetch Suggestions on Typing
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
                return;
            }

            // Debounce API calls to avoid spamming backend
            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`${BASE_URL}/api/product/search?q=${encodeURIComponent(query)}`);
                    const data = await response.json();

                    if (data.success && data.products.length > 0) {
                        renderSuggestions(data.products);
                    } else {
                        searchResults.innerHTML = `<p class="p-3 text-sm text-gray-500">No products found</p>`;
                        searchResults.classList.remove('hidden');
                    }
                } catch (err) {
                    console.error('Error fetching search results:', err);
                }
            }, 300);
        });
    }

    // 3. Render Results Dropdown
    function renderSuggestions(products) {
        searchResults.innerHTML = products.map(product => {
            const rawPrice = (product.variants && product.variants.length > 0 && product.variants[0] && product.variants[0].price != null)
                ? product.variants[0].price
                : (product.price ?? product.discountprice ?? product.productPrice ?? 'N/A');
            const cleanedPrice = (rawPrice === 'N/A' || rawPrice == null) ? '' : String(rawPrice).replace(/[^\d.]/g, '').trim();
            const displayPrice = cleanedPrice ? `${RUPEE_SYMBOL} ${cleanedPrice}` : '';

            return `
                <a href="./product.html?id=${product._id}" class="flex items-center gap-3 p-2 hover:bg-gray-100 transition border-b border-gray-100 last:border-0">
                    <img src="${product.imagepath || product.image || './static/logo2.png'}" alt="${product.name || product.title}" class="w-10 h-10 object-cover rounded">
                    <div>
                        <h4 class="text-sm font-medium text-black">${product.name || product.title}</h4>
                        ${displayPrice ? `<p class="text-xs text-gold font-serif font-semibold" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Symbol', sans-serif;">${displayPrice}</p>` : ''}
                    </div>
                </a>
            `;
        }).join('');

        searchResults.classList.remove('hidden');
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
});