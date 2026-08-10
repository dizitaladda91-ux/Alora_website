import BASE_URL from './config.js';

function getSlugFromLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const postIndex = pathParts.findIndex((part) => part.toLowerCase() === 'post');
    if (postIndex >= 0 && pathParts[postIndex + 1]) {
        return decodeURIComponent(pathParts[postIndex + 1]);
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
        const response = await fetch(`${BASE_URL}/api/blogs/post/${encodeURIComponent(slug)}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to fetch article');
        }

        // Response handling (Extracting blog object)
        const blog = result.data || result.blog || result;

        if (blog) {
            renderArticle(blog);
            injectSEO(blog); // 🟢 SEO Metadata Injector Call
        } else {
            showError("Article not found.");
        }
    } catch (err) {
        console.error("Error loading blog details:", err);
        showError("Failed to load article from server.");
    }
}

function normalizeTitleText(value = '') {
    return String(value).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
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

    document.getElementById('post-title').innerText = blog.title || '';
    document.getElementById('post-category').innerText = blog.category || 'General';

    let contentHtml = blog.content || '';
    contentHtml = sanitizePostBodyContent(contentHtml, blog.title || '');

    document.getElementById('post-body').innerHTML = contentHtml;

    if (blog.createdAt) {
        document.getElementById('post-date').innerText = new Date(blog.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
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

    // 1. Meta Title
    document.title = blog.metaTitle || blog.title || "Alora Radiance";

    // 2. Meta Description
    const metaDescEl = document.getElementById('dynamic-meta-desc');
    if (metaDescEl && blog.metaDesc) {
        metaDescEl.setAttribute('content', blog.metaDesc);
    }

    // 3. Meta Keywords
    const keywordsEl = document.getElementById('dynamic-keywords');
    if (keywordsEl && blog.keywords) {
        keywordsEl.setAttribute('content', blog.keywords);
    }

    // 4. Publisher
    const publisherEl = document.getElementById('dynamic-publisher');
    if (publisherEl && blog.publisher) {
        publisherEl.setAttribute('content', blog.publisher);
    }

    // 5. Canonical Link Tag
    const canonicalEl = document.getElementById('dynamic-canonical');
    if (canonicalEl) {
        canonicalEl.setAttribute('href', currentUrl);
    }

    // 6. Open Graph Tags
    document.getElementById('og-title')?.setAttribute('content', blog.metaTitle || blog.title || '');
    document.getElementById('og-desc')?.setAttribute('content', blog.metaDesc || '');
    document.getElementById('og-url')?.setAttribute('content', currentUrl);

    if (blog.coverImage) {
        const fullImgUrl = blog.coverImage.startsWith('http') ? blog.coverImage : `${BASE_URL}${blog.coverImage}`;
        document.getElementById('og-image')?.setAttribute('content', fullImgUrl);
    }

    // 7. Schema Injection
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
            <div class="text-clay">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                <p class="font-bold">${msg}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', fetchPostDetails);