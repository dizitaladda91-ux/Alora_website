import BASE_URL from './config.js';

function getSlugFromLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;

    // Path structure: /post/saffron-benefits-for-skin ya /blog/saffron-benefits-for-skin
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const postIndex = pathParts.findIndex((part) => part.toLowerCase() === 'post' || part.toLowerCase() === 'blog');
    
    if (postIndex >= 0 && pathParts[postIndex + 1]) {
        return decodeURIComponent(pathParts[postIndex + 1]);
    }

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

    if (!slug) {
        showError("Invalid URL: Post slug is missing.");
        return;
    }

    try {
        const apiPath = BASE_URL ? `${BASE_URL}/api/blogs/post/${encodeURIComponent(slug)}` : `/api/blogs/post/${encodeURIComponent(slug)}`;

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

function sanitizePostBodyContent(contentHtml, blogTitle) {
    if (!contentHtml) return contentHtml;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;

    const h1Nodes = tempDiv.querySelectorAll('h1');
    h1Nodes.forEach((headingNode) => {
        headingNode.remove();
    });

    return tempDiv.innerHTML;
}

// 🟢 Article Details DOM Rendering
function renderArticle(blog) {
    document.getElementById('post-loader')?.classList.add('hidden');
    document.getElementById('blog-content-area')?.classList.remove('hidden');

    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.innerText = blog.title || '';

    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.innerText = blog.category || 'General';

    let contentHtml = blog.content || '';
    contentHtml = sanitizePostBodyContent(contentHtml, blog.title || '');

    const bodyEl = document.getElementById('post-body');
    if (bodyEl) bodyEl.innerHTML = contentHtml;

    if (blog.createdAt) {
        const dateEl = document.getElementById('post-date');
        if (dateEl) {
            dateEl.innerText = new Date(blog.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
    }

    const coverImg = document.getElementById('post-cover');
    if (coverImg && blog.coverImage) {
        coverImg.src = blog.coverImage.startsWith('http') 
            ? blog.coverImage 
            : `${BASE_URL}${blog.coverImage}`;
        coverImg.alt = blog.title || 'Blog Cover';
    }
}

// 🟢 Dynamic SEO & Schema Injector Function
function injectSEO(blog) {
    const currentUrl = window.location.href;
    const finalTitle = blog.metaTitle || blog.title || "Alora Radiance";

    // 1. Browser Tab Title Update
    document.title = finalTitle;

    // 2. DOM Title Element Update (Safe Side)
    const titleEl = document.getElementById('dynamic-title');
    if (titleEl) {
        titleEl.textContent = finalTitle;
    }

    const metaDescEl = document.getElementById('dynamic-meta-desc');
    if (metaDescEl && blog.metaDesc) {
        metaDescEl.setAttribute('content', blog.metaDesc);
    }

    const keywordsEl = document.getElementById('dynamic-keywords');
    if (keywordsEl && blog.keywords) {
        keywordsEl.setAttribute('content', blog.keywords);
    }

    const publisherEl = document.getElementById('dynamic-publisher');
    if (publisherEl && blog.publisher) {
        publisherEl.setAttribute('content', blog.publisher);
    }

    const canonicalEl = document.getElementById('dynamic-canonical');
    if (canonicalEl) {
        canonicalEl.setAttribute('href', currentUrl);
    }

    document.getElementById('og-title')?.setAttribute('content', finalTitle);
    document.getElementById('og-desc')?.setAttribute('content', blog.metaDesc || '');
    document.getElementById('og-url')?.setAttribute('content', currentUrl);

    if (blog.coverImage) {
        const fullImgUrl = blog.coverImage.startsWith('http') ? blog.coverImage : `${BASE_URL}${blog.coverImage}`;
        document.getElementById('og-image')?.setAttribute('content', fullImgUrl);
    }

    const schemaEl = document.getElementById('dynamic-json-ld');
    if (schemaEl && blog.schema) {
        try {
            const parsedSchema = typeof blog.schema === 'string' ? JSON.parse(blog.schema) : blog.schema;
            schemaEl.textContent = JSON.stringify(parsedSchema, null, 2);
        } catch (e) {
            schemaEl.textContent = blog.schema;
        }
    }
}
function showError(msg) {
    const loader = document.getElementById('post-loader');
    if (loader) {
        loader.innerHTML = `
            <div class="text-clay text-center py-10">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-2 text-red-500"></i>
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