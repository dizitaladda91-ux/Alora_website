import BASE_URL from './config.js';

function getSlugFromLocation() {
    // 1. Query parameter check (/post?slug=my-blog)
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;

    // 2. Clean Path check (/post/my-blog OR /blog/my-blog)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    
    if (pathParts.length > 0) {
        // Last segment hi humara slug hoga (e.g., 'saffron-benefits-for-skin')
        const lastSegment = pathParts[pathParts.length - 1];
        
        // Agar last segment file name na ho (jaise post.html ya blog.html)
        if (!lastSegment.endsWith('.html') && lastSegment.toLowerCase() !== 'post' && lastSegment.toLowerCase() !== 'blog') {
            return decodeURIComponent(lastSegment);
        }
    }

    return '';
}

async function fetchPostDetails() {
    const slug = getSlugFromLocation();

    if (!slug) {
        showError("Invalid URL: Post slug is missing.");
        return;
    }

    try {
        // Dynamic API request based on BASE_URL
        // Note: Agar Vercel Deployment par relative backend route hai to empty string fallback handle karein
        const apiUrl = BASE_URL ? `${BASE_URL}/api/blogs/post/${encodeURIComponent(slug)}` : `/api/blogs/post/${encodeURIComponent(slug)}`;
        
        const response = await fetch(apiUrl);
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
        showError("Failed to load article from server.");
    }
}