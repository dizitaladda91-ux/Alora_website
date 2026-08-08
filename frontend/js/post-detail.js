import BASE_URL from './config.js';

// 1. Slug Extractor
function getSlugFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;

    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];

    if (lastSegment && !lastSegment.endsWith('.html') && lastSegment !== 'post' && lastSegment !== 'blogs') {
        return lastSegment;
    }

    return null;
}

// 2. URL Formatter & Fix Navigation Paths
function setupLocalCleanURL(slug) {
    if (!slug) return;

    // A. URL se ?slug= hata kar /post.html/slug banana
    if (window.location.search.includes('slug=')) {
        const cleanURL = `${window.location.pathname}/${slug}`;
        window.history.replaceState({}, '', cleanURL);
    }

    // B. Navbar links ko fix karna taaki /post.html/ ke andar navigation na toote
    setTimeout(() => {
        const navLinks = document.querySelectorAll('nav a, #navbar-placeholder a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('./')) {
                // Determine base path (/frontend/ or /)
                const isFrontendPath = window.location.pathname.includes('/frontend/');
                const basePath = isFrontendPath ? '/frontend/' : '/';
                const cleanHref = href.replace('./', basePath);
                link.setAttribute('href', cleanHref);
            }
        });
    }, 100); // Small delay to wait for dynamic navbar load
}

async function fetchPostDetails() {
    const slug = getSlugFromURL();

    if (!slug) {
        showError("Invalid URL: Post slug is missing.");
        return;
    }

    // Clean URL apply + Navigation links fix
    setupLocalCleanURL(slug);

    try {
        const response = await fetch(`${BASE_URL}/api/blogs/post/${slug}`);
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

// 🟢 Article Details DOM Rendering
function renderArticle(blog) {
    document.getElementById('post-loader')?.classList.add('hidden');
    document.getElementById('blog-content-area')?.classList.remove('hidden');

    document.getElementById('post-title').innerText = blog.title || '';
    document.getElementById('post-category').innerText = blog.category || 'General';

    let contentHtml = blog.content || '';

    if (contentHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentHtml;
        const firstElem = tempDiv.firstElementChild;
        if (firstElem && firstElem.tagName.toLowerCase() === 'h1') {
            const h1Text = firstElem.innerText.trim().toLowerCase();
            const titleText = (blog.title || '').trim().toLowerCase();
            if (h1Text === titleText || h1Text.includes(titleText) || titleText.includes(h1Text)) {
                firstElem.remove();
                contentHtml = tempDiv.innerHTML;
            }
        }
    }

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

    document.title = blog.metaTitle || blog.title || "Alora Radiance";

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

    document.getElementById('og-title')?.setAttribute('content', blog.metaTitle || blog.title || '');
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
            <div class="text-clay">
                <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                <p class="font-bold">${msg}</p>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', fetchPostDetails);