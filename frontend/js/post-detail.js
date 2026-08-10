import BASE_URL from './config.js';

function getSlugFromLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;

    // Route: /post/saffron-benefits-for-skin
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const postIndex = pathParts.findIndex((part) => part.toLowerCase() === 'post' || part.toLowerCase() === 'blog');
    
    if (postIndex >= 0 && pathParts[postIndex + 1]) {
        return decodeURIComponent(pathParts[postIndex + 1]);
    }

    // Fallback: URL ka aakhiri segment lein
    if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (!lastPart.endsWith('.html')) {
            return decodeURIComponent(lastPart);
        }
    }

    return '';
}

async function fetchPostDetails() {
    const slug = getSlugFromLocation();
    console.log("Extracted Slug:", slug); // Console log testing ke liye

    if (!slug) {
        showError("Invalid URL: Post slug is missing.");
        return;
    }

    try {
        const apiPath = BASE_URL ? `${BASE_URL}/api/blogs/post/${encodeURIComponent(slug)}` : `/api/blogs/post/${encodeURIComponent(slug)}`;
        console.log("Fetching API URL:", apiPath);

        const response = await fetch(apiPath);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to fetch article');
        }

        const blog = result.data || result.blog || result;

        if (blog) {
            renderArticle(blog);
            injectSEO(blog);
        } else {
            showError("Article not found.");
        }
    } catch (err) {
        console.error("Error loading blog details:", err);
        showError("Failed to load article: " + err.message);
    }
}

// Global functions & event listener
function showError(msg) {
    const loader = document.getElementById('post-loader');
    if (loader) {
        loader.innerHTML = `
            <div class="text-clay text-center py-10">
                <p class="font-bold text-red-600 text-lg">${msg}</p>
            </div>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchPostDetails);
} else {
    fetchPostDetails();
}