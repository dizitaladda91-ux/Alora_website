import BASE_URL, { getImageUrl, safeFetchJson, getProductUrl } from './config.js';
function getSlugFromLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('slug');
    if (querySlug) return querySlug;
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
    
    // 1. Remove duplicate H1 tags if present
    const h1Nodes = tempDiv.querySelectorAll('h1');
    h1Nodes.forEach((headingNode) => {
        headingNode.remove();
    });

    // 2. Clean empty paragraphs & unwrap accidental full-paragraph bolding from pasted text
    const pNodes = tempDiv.querySelectorAll('p');
    pNodes.forEach((p) => {
        const text = p.innerText ? p.innerText.trim() : '';
        const html = p.innerHTML.trim().toLowerCase();

        if (!text && (html === '' || html === '<br>' || html === '&nbsp;')) {
            p.remove();
            return;
        }

        // Strip inline font-weight on paragraph level
        if (p.style && p.style.fontWeight) {
            p.style.fontWeight = '';
        }

        // Strip inline font-weight on span level if wrapping full text
        p.querySelectorAll('span').forEach((span) => {
            if (span.style && (span.style.fontWeight === 'bold' || span.style.fontWeight === '700' || span.style.fontWeight === '600')) {
                if (span.innerText && span.innerText.trim() === text) {
                    span.style.fontWeight = '';
                }
            }
        });

        // Unwrap <strong> or <b> if it wraps 100% of paragraph text (accidental full-paragraph bold)
        const children = Array.from(p.childNodes).filter((node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim().length > 0));
        if (children.length === 1 && (children[0].tagName === 'STRONG' || children[0].tagName === 'B')) {
            const boldElem = children[0];
            while (boldElem.firstChild) {
                p.insertBefore(boldElem.firstChild, boldElem);
            }
            boldElem.remove();
        }
    });

    // 3. Style grid tables
    const tableNodes = tempDiv.querySelectorAll('table');
    tableNodes.forEach((table) => {
        table.classList.add('w-full', 'my-6', 'border-collapse', 'rounded-xl', 'overflow-hidden');
        if (!table.parentElement || !table.parentElement.classList.contains('blog-table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'blog-table-responsive overflow-x-auto my-6 rounded-2xl border border-slate-300 shadow-sm bg-white';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    return tempDiv.innerHTML;
}
function decodeEntities(str) {
    if (str === null || str === undefined) return '';
    let decoded = String(str);
    let previous;
    let iterations = 0;
    do {
        previous = decoded;
        decoded = decoded
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;|&#39;|&apos;/gi, "'");
        iterations++;
    } while (decoded !== previous && iterations < 5);
    return decoded;
}

function renderArticle(blog) {
    document.getElementById('post-loader')?.classList.add('hidden');
    document.getElementById('blog-content-area')?.classList.remove('hidden');
    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.innerText = decodeEntities(blog.title || '');
    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.innerText = decodeEntities(blog.category || 'General');
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
    const coverContainer = coverImg?.parentElement;
    const coverUrl = blog.coverImage || blog.coverUrl || '';
    if (coverImg) {
        if (coverUrl && typeof coverUrl === 'string' && coverUrl.trim()) {
            let finalUrl = coverUrl.trim();
            if (!finalUrl.startsWith('http') && !finalUrl.startsWith('/')) {
                finalUrl = `/${finalUrl}`;
            }
            if (!finalUrl.startsWith('http') && BASE_URL) {
                finalUrl = `${BASE_URL}${finalUrl}`;
            }
            coverImg.src = finalUrl;
            coverImg.alt = blog.title || 'Blog Cover';
            if (coverContainer) coverContainer.classList.remove('hidden');
            coverImg.onerror = () => {
                if (coverContainer) coverContainer.classList.add('hidden');
            };
        } else {
            if (coverContainer) coverContainer.classList.add('hidden');
        }
    }
    // Generate Left Table of Contents Sidebar & Mobile Accordion
    generateTableOfContents();
    // Render Category-Related Products Below Blog Article
    renderRelatedProducts(blog);
}

async function renderRelatedProducts(blog) {
    const sectionEl = document.getElementById('related-products-section');
    const gridEl = document.getElementById('related-products-grid');
    const headingEl = document.getElementById('related-products-heading');

    if (!sectionEl || !gridEl) return;

    try {
        const apiPath = BASE_URL ? `${BASE_URL}/api/product/all` : `/api/product/all`;
        let result = await safeFetchJson(apiPath);

        if (!result) {
            const res = await fetch(apiPath);
            if (res.ok) result = await res.json();
        }

        const allProducts = Array.isArray(result) 
            ? result 
            : (result?.products || result?.data || []);

        if (!allProducts || allProducts.length === 0) return;

        const category = (blog.category || '').toLowerCase().trim();
        const blogTitle = (blog.title || '').toLowerCase().trim();
        const blogKeywords = (blog.keywords || '').toLowerCase().trim();

        const categoryKeywords = ['lotion', 'serum', 'face wash', 'facewash', 'scrub', 'cream', 'sunscreen', 'kit', 'cleanser', 'travel', 'radiance'];
        let matchedCategoryKey = categoryKeywords.find(key => category.includes(key) || blogTitle.includes(key) || blogKeywords.includes(key)) || category;

        let matchedProducts = allProducts.filter(p => {
            const pCat = (p.category || '').toLowerCase();
            const pName = (p.name || p.title || '').toLowerCase();
            const pDesc = (p.description || '').toLowerCase();

            if (category && (pCat.includes(category) || pName.includes(category))) return true;
            if (matchedCategoryKey && (pCat.includes(matchedCategoryKey) || pName.includes(matchedCategoryKey) || pDesc.includes(matchedCategoryKey))) return true;
            return false;
        });

        if (matchedProducts.length === 0) {
            matchedProducts = allProducts.slice(0, 3);
        } else if (matchedProducts.length < 3) {
            const otherProducts = allProducts.filter(p => !matchedProducts.includes(p));
            matchedProducts = matchedProducts.concat(otherProducts.slice(0, 3 - matchedProducts.length));
        }

        matchedProducts = matchedProducts.slice(0, 3);

        if (headingEl) {
            headingEl.innerText = blog.category ? `Recommended ${blog.category} Products` : `Recommended Products for You`;
        }

        gridEl.innerHTML = '';

        matchedProducts.forEach(product => {
            const prodName = product.name || product.title || 'Alora Skincare Product';
            const prodPrice = product.variants?.[0]?.price || product.price || (product.sizes && product.sizes[0]?.price) || 0;
            const prodMrp = product.variants?.[0]?.comparePrice || product.mrp || product.comparePrice || (product.sizes && product.sizes[0]?.mrp) || 0;
            const imgRaw = product.imagepath || (product.galleryImages && product.galleryImages[0]) || (product.images && product.images[0]) || product.image || '';
            const prodImg = getImageUrl(imgRaw) || './static/logo2.png';
            const prodUrl = getProductUrl(product);

            const cardHtml = `
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-amber-900/10 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
                    <a href="${prodUrl}" class="block relative aspect-square rounded-xl overflow-hidden mb-3 bg-slate-50">
                        <img src="${prodImg}" alt="${prodName}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.onerror=null; this.src='./static/logo2.png'">
                        ${prodMrp > prodPrice ? `<span class="absolute top-2 left-2 bg-[#800000] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">SALE</span>` : ''}
                    </a>
                    <div>
                        <a href="${prodUrl}" class="font-bold text-sm text-slate-900 hover:text-[#8B4513] transition-colors line-clamp-2 mb-1">
                            ${prodName}
                        </a>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="font-extrabold text-sm text-[#800000]">₹${prodPrice}</span>
                            ${prodMrp > prodPrice ? `<span class="text-xs text-slate-400 line-through">₹${prodMrp}</span>` : ''}
                        </div>
                    </div>
                    <a href="${prodUrl}" class="w-full bg-[#152219] hover:bg-amber-950 text-white text-xs font-bold py-2 rounded-xl text-center transition-colors flex items-center justify-center gap-1.5 shadow-xs">
                        <i class="fa-solid fa-bag-shopping text-[11px]"></i> Shop Now
                    </a>
                </div>
            `;

            gridEl.innerHTML += cardHtml;
        });

        sectionEl.classList.remove('hidden');

    } catch (err) {
        console.warn("Failed to load related category products:", err);
    }
}

function generateTableOfContents() {
    const postBody = document.getElementById('post-body');
    const tocList = document.getElementById('toc-list');
    const mobileTocList = document.getElementById('mobile-toc-list');
    const tocSidebarContainer = document.getElementById('toc-sidebar-container');
    const mobileTocContainer = document.getElementById('mobile-toc-container');

    if (!postBody || (!tocList && !mobileTocList)) return;

    const headings = Array.from(postBody.querySelectorAll('h2, h3'));

    if (headings.length === 0) {
        if (tocSidebarContainer) tocSidebarContainer.classList.add('hidden');
        if (mobileTocContainer) mobileTocContainer.classList.add('hidden');
        return;
    }

    let tocHtml = '';
    let mobileTocHtml = '';

    headings.forEach((heading, index) => {
        if (!heading.id) {
            heading.id = `section-heading-${index + 1}`;
        }

        const headingText = heading.innerText.trim();
        const isH3 = heading.tagName.toLowerCase() === 'h3';
        const indentClass = isH3 ? 'pl-5 text-xs font-normal text-slate-500' : 'font-bold text-slate-800 text-xs sm:text-sm';

        tocHtml += `
            <a href="#${heading.id}" data-heading-id="${heading.id}" class="toc-link group flex items-start gap-2 py-2 px-3 rounded-xl hover:bg-amber-100/60 text-slate-600 hover:text-[#8B4513] transition-all duration-200 ${indentClass}">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 group-hover:scale-125 transition-transform"></span>
                <span class="line-clamp-2">${headingText}</span>
            </a>
        `;

        mobileTocHtml += `
            <a href="#${heading.id}" class="mobile-toc-link block py-1.5 px-2 rounded-lg hover:bg-amber-100/50 text-slate-700 hover:text-[#8B4513] ${indentClass}">
                ${headingText}
            </a>
        `;
    });

    if (tocList) tocList.innerHTML = tocHtml;
    if (mobileTocList) mobileTocList.innerHTML = mobileTocHtml;

    if (tocSidebarContainer) tocSidebarContainer.classList.remove('hidden');
    if (mobileTocContainer) mobileTocContainer.classList.remove('hidden');

    document.querySelectorAll('.toc-link, .mobile-toc-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href')?.replace('#', '');
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                const navHeight = 100;
                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: elementPosition - navHeight,
                    behavior: 'smooth'
                });
            }
        });
    });

    const observerOptions = {
        root: null,
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const activeId = entry.target.id;
                document.querySelectorAll('.toc-link').forEach((link) => {
                    if (link.getAttribute('data-heading-id') === activeId) {
                        link.classList.add('bg-amber-100', 'text-[#8B4513]', 'font-extrabold', 'shadow-xs');
                    } else {
                        link.classList.remove('bg-amber-100', 'text-[#8B4513]', 'font-extrabold', 'shadow-xs');
                    }
                });
            }
        });
    }, observerOptions);

    headings.forEach((heading) => observer.observe(heading));
}
function injectSEO(blog) {
    const currentUrl = window.location.href;
    const finalTitle = decodeEntities(blog.metaTitle || blog.title || "Alora Radiance");
    document.title = finalTitle;
    const titleEl = document.getElementById('dynamic-title');
    if (titleEl) {
        titleEl.textContent = finalTitle;
    }
    const metaDescEl = document.getElementById('dynamic-meta-desc');
    if (metaDescEl && blog.metaDesc) {
        metaDescEl.setAttribute('content', decodeEntities(blog.metaDesc));
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
    injectMultipleSchemasToDOM(blog.schema);
}
function parseMultipleSchemas(rawInput) {
    if (!rawInput || !String(rawInput).trim()) return [];
    let cleaned = String(rawInput).trim();
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
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.filter(item => item && typeof item === 'object');
        }
        if (parsed && typeof parsed === 'object') {
            return [parsed];
        }
    } catch (e) {
    }
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