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

    // Remove redundant h1 tags matching title
    const h1Nodes = tempDiv.querySelectorAll('h1');
    h1Nodes.forEach((headingNode) => {
        headingNode.remove();
    });

    // Clean up empty paragraphs (<p><br></p> or <p>&nbsp;</p>) that cause huge vertical gaps
    const pNodes = tempDiv.querySelectorAll('p');
    pNodes.forEach((p) => {
        const text = p.innerText ? p.innerText.trim() : '';
        const html = p.innerHTML.trim().toLowerCase();
        if (!text && (html === '' || html === '<br>' || html === '&nbsp;')) {
            p.remove();
        }
    });

    // Wrap tables in responsive scroll container
    const tableNodes = tempDiv.querySelectorAll('table');
    tableNodes.forEach((table) => {
        if (!table.parentElement || !table.parentElement.classList.contains('blog-table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'blog-table-responsive overflow-x-auto my-6 rounded-2xl border border-amber-900/10 shadow-sm bg-white';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
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

    // DYNAMIC JSON-LD MULTI-SCHEMA INJECTOR (Only injects schemas explicitly entered in Admin)
    injectMultipleSchemasToDOM(blog.schema);
}

// 🌐 Universal Multi-Schema Helper Functions
function parseMultipleSchemas(rawInput) {
    if (!rawInput || !String(rawInput).trim()) return [];
    let cleaned = String(rawInput).trim();

    // 1. If wrapped in <script> tags, extract contents of all script tags
    if (cleaned.includes('<script')) {
        const scriptMatches = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches && scriptMatches.length > 0) {
            const extracted = [];
            for (const match of scriptMatches) {
                const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                if (content) {
                    const subSchemas = parseMultipleSchemas(content);
                    extracted.push(...subSchemas);
                }
            }
            if (extracted.length > 0) return extracted;
        } else {
            cleaned = cleaned.replace(/<[^>]*>/g, '').trim();
        }
    }

    // 2. Direct JSON.parse (Handles single object, JSON Array [...], or @graph)
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.filter(item => item && typeof item === 'object');
        }
        if (parsed && typeof parsed === 'object') {
            return [parsed];
        }
    } catch (e) {
        // Concatenated JSON objects `{...} {...}` fallback
    }

    // 3. Fallback: Parse multiple concatenated JSON objects `{...}\n{...}`
    const schemas = [];
    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        if (isEscaped) {
            isEscaped = false;
            continue;
        }
        if (char === '\\') {
            isEscaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === '{' || char === '[') {
                if (depth === 0) startIndex = i;
                depth++;
            } else if (char === '}' || char === ']') {
                depth--;
                if (depth === 0 && startIndex !== -1) {
                    const jsonChunk = cleaned.substring(startIndex, i + 1).trim();
                    try {
                        const parsedObj = JSON.parse(jsonChunk);
                        if (Array.isArray(parsedObj)) {
                            schemas.push(...parsedObj.filter(item => item && typeof item === 'object'));
                        } else if (parsedObj && typeof parsedObj === 'object') {
                            schemas.push(parsedObj);
                        }
                    } catch (err) {
                        console.warn("Failed parsing schema chunk:", err);
                    }
                    startIndex = -1;
                }
            }
        }
    }
    return schemas;
}

function injectMultipleSchemasToDOM(rawSchemaInput) {
    document.querySelectorAll('.dynamic-schema-injected, #dynamic-json-ld').forEach(el => el.remove());

    if (!rawSchemaInput || !String(rawSchemaInput).trim()) return;

    let schemasToInject = parseMultipleSchemas(rawSchemaInput);

    if (!schemasToInject || schemasToInject.length === 0) return;

    if (schemasToInject.length === 1) {
        const script = document.createElement('script');
        script.id = 'dynamic-json-ld';
        script.type = 'application/ld+json';
        script.className = 'dynamic-schema-injected';
        script.textContent = JSON.stringify(schemasToInject[0], null, 2);
        document.head.appendChild(script);
    } else {
        // Multiple schemas: Inject combined Google-compliant @graph schema
        const script = document.createElement('script');
        script.id = 'dynamic-json-ld';
        script.type = 'application/ld+json';
        script.className = 'dynamic-schema-injected';

        const combinedSchema = {
            "@context": "https://schema.org",
            "@graph": schemasToInject.map(s => {
                const copy = { ...s };
                if (copy["@context"]) delete copy["@context"];
                return copy;
            })
        };

        script.textContent = JSON.stringify(combinedSchema, null, 2);
        document.head.appendChild(script);
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