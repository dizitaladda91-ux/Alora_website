import sanitizeHtml from "sanitize-html";
import { sanitizeBlogHtml, decodeEntities, parseAndNormalizeSchemas } from "./contentSanitizer.service.js";

const DOMAIN = "https://aloraradiance.com";

const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

export const formatImageUrl = (imagePath, fallback = `${DOMAIN}/static/placeholder.png`) => {
    if (!imagePath || typeof imagePath !== 'string') return fallback;
    const trimmed = imagePath.trim();
    if (!trimmed) return fallback;

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
        return trimmed
            .replace('/upload/f_auto,q_auto,w_400,c_limit/', '/upload/')
            .replace('/upload/f_auto,q_auto:best,w_1400,c_limit,dpr_auto/', '/upload/');
    }

    const normalized = trimmed.replace(/^\.?\//, '/');
    const pathStr = normalized.startsWith('/') ? normalized : '/' + normalized;
    return `${DOMAIN}${pathStr}`;
};

export const getProductSlugUrl = (product) => {
    const slug = String(product?.slug || product?.name || "product")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${DOMAIN}/product/${encodeURIComponent(slug || "product")}`;
};

export const getBlogSlugUrl = (post) => {
    const slug = String(post?.slug || post?.title || "article")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${DOMAIN}/blog/${encodeURIComponent(slug || "article")}`;
};

const generateStarsHtml = (rating = 4) => {
    const rounded = Math.round(Number(rating) || 4);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rounded) {
            html += `<i class="fa-solid fa-star text-amber-500"></i>`;
        } else {
            html += `<i class="fa-regular fa-star text-slate-300"></i>`;
        }
    }
    return html;
};

// Extract H2 & H3 headings to pre-render Table of Contents for SSR
const extractTocAndAnnotateHeadings = (rawHtml) => {
    if (!rawHtml) return { tocHtml: '', annotatedHtml: '' };

    const headingRegex = /<h([23])\b([^>]*)>(.*?)<\/h\1>/gis;
    const tocItems = [];
    let counter = 0;

    const annotatedHtml = rawHtml.replace(headingRegex, (match, level, attribs, content) => {
        counter++;
        const plainText = content.replace(/<[^>]+>/g, '').trim();
        const idMatch = attribs.match(/id=["']([^"']+)["']/i);
        const id = idMatch ? idMatch[1] : `heading-${counter}-${plainText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        tocItems.push({
            level: parseInt(level, 10),
            id,
            text: plainText
        });

        if (idMatch) {
            return match;
        }
        return `<h${level} id="${id}" ${attribs}>${content}</h${level}>`;
    });

    if (tocItems.length === 0) {
        return { tocHtml: '<p class="text-xs text-slate-400 py-1">Quick Overview</p>', annotatedHtml };
    }

    const tocHtml = tocItems.map(item => {
        const indentClass = item.level === 3 ? 'pl-4 text-xs font-normal text-slate-600' : 'font-medium text-slate-800 text-xs sm:text-sm';
        return `
            <a href="#${item.id}" class="block py-1 px-2 rounded-lg hover:bg-amber-100/60 hover:text-[#8B4513] transition-colors ${indentClass}">
                ${escapeHtml(item.text)}
            </a>
        `;
    }).join('');

    return { tocHtml, annotatedHtml };
};

// ==========================================
// 1. BLOG ARTICLE DETAIL SSR PRE-RENDERER
// ==========================================
export const renderBlogArticleSsr = (templateHtml, blog, relatedProducts = []) => {
    if (!blog) return templateHtml;

    let html = templateHtml;

    const cleanTitle = escapeHtml(blog.metaTitle || blog.title || 'Alora Radiance');
    const cleanDesc = escapeHtml(blog.metaDesc || blog.title || 'Explore expert skincare insights and healthy skin guides by Alora Radiance.');
    const cleanKeywords = escapeHtml(blog.keywords || `${blog.title}, skincare, Alora Radiance`);
    const canonicalUrl = getBlogSlugUrl(blog);
    const coverUrl = formatImageUrl(blog.coverImage || blog.coverUrl || '/static/logo2.png');
    const pubDate = blog.createdAt ? new Date(blog.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    // Head Metadata Replacements
    html = html.replace(/<title id="dynamic-title">.*?<\/title>/i, `<title id="dynamic-title">${cleanTitle} | Alora Radiance</title>`);
    html = html.replace(/<title>.*?<\/title>/i, `<title>${cleanTitle} | Alora Radiance</title>`);
    html = html.replace(/<meta id="dynamic-meta-desc" name="description" content="[^"]*">/i, `<meta id="dynamic-meta-desc" name="description" content="${cleanDesc}">`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="dynamic-keywords" name="keywords" content="[^"]*">/i, `<meta id="dynamic-keywords" name="keywords" content="${cleanKeywords}">`);
    html = html.replace(/<link id="dynamic-canonical" rel="canonical" href="[^"]*" \/>/i, `<link id="dynamic-canonical" rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta id="og-title" property="og:title" content="[^"]*">/i, `<meta id="og-title" property="og:title" content="${cleanTitle}">`);
    html = html.replace(/<meta id="og-desc" property="og:description" content="[^"]*">/i, `<meta id="og-desc" property="og:description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="og-image" property="og:image" content="[^"]*">/i, `<meta id="og-image" property="og:image" content="${coverUrl}">`);
    html = html.replace(/<meta id="og-url" property="og:url" content="[^"]*">/i, `<meta id="og-url" property="og:url" content="${canonicalUrl}">`);

    // Schema Markup Injection
    const schemaObj = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": blog.title,
        "description": blog.metaDesc || blog.title,
        "image": coverUrl,
        "datePublished": blog.createdAt || new Date().toISOString(),
        "dateModified": blog.updatedAt || blog.createdAt || new Date().toISOString(),
        "author": {
            "@type": "Organization",
            "name": "Alora Radiance",
            "url": DOMAIN
        },
        "publisher": {
            "@type": "Organization",
            "name": "Alora Radiance",
            "logo": {
                "@type": "ImageObject",
                "url": `${DOMAIN}/static/logo2.png`
            }
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": canonicalUrl
        }
    };
    html = html.replace(/<script id="dynamic-json-ld" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="dynamic-json-ld" type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`);

    // Process Body HTML Content & TOC
    const rawBody = blog.content || '';
    const sanitizedBody = sanitizeBlogHtml(rawBody);
    const { tocHtml, annotatedHtml } = extractTocAndAnnotateHeadings(sanitizedBody);

    // Hide loader, unhide article
    html = html.replace(/<div id="post-loader"[^>]*>[\s\S]*?<\/div>/i, `<div id="post-loader" class="hidden"></div>`);
    html = html.replace(/<article id="blog-content-area" class="hidden\s+/i, `<article id="blog-content-area" class="`);

    // Inject Article Top Meta (Category, Date, Title, Cover Image)
    html = html.replace(/<span id="post-category"[^>]*>.*?<\/span>/i, `<span id="post-category" class="bg-amber-100/70 text-[#8B4513] px-3 py-1 rounded-full text-[11px] font-bold uppercase font-roboto border border-amber-300/40">${escapeHtml(blog.category || 'Skincare')}</span>`);
    html = html.replace(/<span id="post-date"[^>]*>.*?<\/span>/i, `<span id="post-date" class="text-slate-500 font-medium">${pubDate}</span>`);
    html = html.replace(/<h1 id="post-title"[^>]*>.*?<\/h1>/i, `<h1 id="post-title" class="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-fraunces font-bold text-ink leading-snug text-slate-900 break-words overflow-wrap-anywhere">${escapeHtml(blog.title)}</h1>`);

    if (coverUrl) {
        html = html.replace(
            /<div id="post-cover-container" class="hidden\s+/i,
            `<div id="post-cover-container" class="`
        );
        html = html.replace(
            /<img id="post-cover" src="" alt=""/i,
            `<img id="post-cover" src="${coverUrl}" alt="${escapeHtml(blog.title)}"`
        );
    }

    // Inject Body Content & TOC
    html = html.replace(/<div id="post-body" class="post-body-content text-slate-800">[\s\S]*?<\/div>/i, `<div id="post-body" class="post-body-content text-slate-800">${annotatedHtml}</div>`);
    html = html.replace(/<nav id="toc-list"[^>]*>[\s\S]*?<\/nav>/i, `<nav id="toc-list" class="space-y-1 text-sm font-sans">${tocHtml}</nav>`);
    html = html.replace(/<nav id="mobile-toc-list"[^>]*>[\s\S]*?<\/nav>/i, `<nav id="mobile-toc-list" class="mt-3 pt-3 border-t border-amber-200/60 space-y-1.5 text-xs font-sans">${tocHtml}</nav>`);

    // Pre-render Related Products Cards if present
    if (Array.isArray(relatedProducts) && relatedProducts.length > 0) {
        const cardsHtml = relatedProducts.map(p => {
            const pUrl = getProductSlugUrl(p);
            const pImg = formatImageUrl(p.imagepath);
            const pPrice = (p.variants && p.variants.length > 0) ? p.variants[0].price : (p.price || 0);
            const pMrp = (p.variants && p.variants.length > 0) ? p.variants[0].comparePrice : (p.comparePrice || 0);
            let pctBadge = '';
            if (pMrp && pMrp > pPrice) {
                const pct = Math.round(((pMrp - pPrice) / pMrp) * 100);
                if (pct > 0) pctBadge = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">${pct}% OFF</span>`;
            }

            return `
                <div class="bg-white rounded-2xl p-4 border border-amber-900/10 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <a href="${pUrl}" class="block aspect-square rounded-xl overflow-hidden mb-3 bg-amber-50/50">
                        <img src="${pImg}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover hover:scale-105 transition duration-300" loading="lazy">
                    </a>
                    <div>
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-[10px] font-bold text-[#8B4513] uppercase tracking-wider">${escapeHtml(p.category || 'SKINCARE')}</span>
                            ${pctBadge}
                        </div>
                        <h4 class="font-fraunces font-bold text-slate-900 text-sm line-clamp-1 mb-1">
                            <a href="${pUrl}" class="hover:text-[#8B4513] transition">${escapeHtml(p.name)}</a>
                        </h4>
                        <div class="flex items-baseline gap-2 mb-3">
                            <span class="text-base font-bold text-slate-900 font-serif">₹${pPrice}</span>
                            ${pMrp ? `<span class="text-xs text-slate-400 line-through">₹${pMrp}</span>` : ''}
                        </div>
                    </div>
                    <a href="${pUrl}" class="w-full text-center bg-amber-100 hover:bg-[#8B4513] text-[#8B4513] hover:text-white font-bold text-xs py-2 rounded-xl transition">
                        View Product
                    </a>
                </div>
            `;
        }).join('');

        html = html.replace(/<section id="related-products-section" class="hidden\s+/i, `<section id="related-products-section" class="`);
        html = html.replace(/<div id="related-products-grid"[^>]*>[\s\S]*?<\/div>/i, `<div id="related-products-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">${cardsHtml}</div>`);
    }

    return html;
};

// ==========================================
// 2. BLOG LISTING PAGE SSR PRE-RENDERER
// ==========================================
export const renderBlogListSsr = (templateHtml, posts = []) => {
    let html = templateHtml;

    const title = "Alora Radiance | Skincare Blog & Beauty Guides";
    const desc = "Explore stories, expert skincare routines, ingredient guides, and beauty insights from Alora Radiance.";
    const canonical = `${DOMAIN}/blog`;

    html = html.replace(/<title id="dynamic-title">.*?<\/title>/i, `<title id="dynamic-title">${title}</title>`);
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta id="dynamic-meta-desc" name="description" content="[^"]*">/i, `<meta id="dynamic-meta-desc" name="description" content="${desc}">`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${desc}">`);
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${canonical}" />`);

    if (Array.isArray(posts) && posts.length > 0) {
        const cardsHtml = posts.map(post => {
            const pUrl = getBlogSlugUrl(post);
            const pCover = formatImageUrl(post.coverImage || post.coverUrl || '/static/logo2.png');
            const pDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            const plainDesc = (post.metaDesc || post.title || '').slice(0, 140);

            return `
                <article class="bg-white rounded-3xl overflow-hidden border border-amber-900/10 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                    <a href="${pUrl}" class="block aspect-[16/10] overflow-hidden bg-slate-100">
                        <img src="${pCover}" alt="${escapeHtml(post.title)}" class="w-full h-full object-cover hover:scale-105 transition duration-500" loading="lazy">
                    </a>
                    <div class="p-6 flex-grow flex flex-col justify-between space-y-4">
                        <div>
                            <div class="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                <span class="bg-amber-100/80 text-[#8B4513] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border border-amber-300/40">${escapeHtml(post.category || 'Skincare')}</span>
                                <span>•</span>
                                <span>${pDate}</span>
                            </div>
                            <h3 class="text-xl font-fraunces font-bold text-slate-900 leading-tight mb-2 hover:text-[#8B4513] transition">
                                <a href="${pUrl}">${escapeHtml(post.title)}</a>
                            </h3>
                            <p class="text-xs text-slate-600 line-clamp-3 leading-relaxed font-sans">
                                ${escapeHtml(plainDesc)}
                            </p>
                        </div>
                        <a href="${pUrl}" class="inline-flex items-center gap-2 text-xs font-bold text-[#8B4513] hover:text-amber-900 transition">
                            Read Full Article <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </a>
                    </div>
                </article>
            `;
        }).join('');

        html = html.replace(/<div id="blog-posts-grid"[^>]*>[\s\S]*?<\/div>/i, `<div id="blog-posts-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cardsHtml}</div>`);
    }

    return html;
};

// ==========================================
// 3. INDIVIDUAL PRODUCT DETAIL SSR PRE-RENDERER
// ==========================================
export const renderProductSsr = (templateHtml, product, faqs = []) => {
    if (!product) return templateHtml;

    let html = templateHtml;

    const cleanTitle = escapeHtml(product.metaTitle || product.name || 'Alora Radiance');
    const cleanDesc = escapeHtml(product.metaDescription || product.description || 'Luxury dermatologist-tested skincare formulation.');
    const cleanKeywords = escapeHtml(product.keywords || `${product.name}, skincare, luxury skincare, Alora Radiance`);
    const canonicalUrl = getProductSlugUrl(product);
    const mainImg = formatImageUrl(product.imagepath);
    const firstVariant = (product.variants && product.variants.length > 0) ? product.variants[0] : null;
    const price = firstVariant ? firstVariant.price : (product.price || 0);
    const mrp = firstVariant ? firstVariant.comparePrice : (product.comparePrice || 0);

    // Head Metadata Replacements
    html = html.replace(/<title>.*?<\/title>/i, `<title>${cleanTitle} | Alora Radiance</title>`);
    html = html.replace(/<meta id="dynamic-meta-desc" name="description" content="[^"]*">/i, `<meta id="dynamic-meta-desc" name="description" content="${cleanDesc}">`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="dynamic-keywords" name="keywords" content="[^"]*">/i, `<meta id="dynamic-keywords" name="keywords" content="${cleanKeywords}">`);
    html = html.replace(/<link id="dynamic-canonical" rel="canonical" href="[^"]*" \/>/i, `<link id="dynamic-canonical" rel="canonical" href="${canonicalUrl}" />`);

    // Open Graph
    html = html.replace(/<meta id="og-title" property="og:title" content="[^"]*">/i, `<meta id="og-title" property="og:title" content="${cleanTitle}">`);
    html = html.replace(/<meta id="og-desc" property="og:description" content="[^"]*">/i, `<meta id="og-desc" property="og:description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="og-image" property="og:image" content="[^"]*">/i, `<meta id="og-image" property="og:image" content="${mainImg}">`);
    html = html.replace(/<meta id="og-url" property="og:url" content="[^"]*">/i, `<meta id="og-url" property="og:url" content="${canonicalUrl}">`);

    // Schema.org Product JSON-LD
    const productSchema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "image": [mainImg, ...(product.galleryImages || []).map(g => formatImageUrl(g))],
        "description": product.description || product.metaDescription,
        "sku": String(product._id),
        "brand": {
            "@type": "Brand",
            "name": "Alora Radiance"
        },
        "offers": {
            "@type": "Offer",
            "url": canonicalUrl,
            "priceCurrency": "INR",
            "price": String(price),
            "availability": "https://schema.org/InStock",
            "seller": {
                "@type": "Organization",
                "name": "Alora Radiance"
            }
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": String(product.rating || 4.5),
            "reviewCount": String(product.numReviews || 12)
        }
    };

    html = html.replace(
        /<\/head>/i,
        `<script type="application/ld+json">\n${JSON.stringify(productSchema, null, 2)}\n</script>\n</head>`
    );

    // Body Image & Badges
    html = html.replace(/<img id="main-product-image"[^>]*>/i, `<img id="main-product-image" src="${mainImg}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" decoding="async" fetchpriority="high" onerror="this.onerror=null; this.src='/static/placeholder.png'">`);
    html = html.replace(/<span id="product-category-badge"[^>]*>.*?<\/span>/i, `<span id="product-category-badge" class="text-[11px] font-bold tracking-widest text-clay uppercase bg-sand/60 px-3 py-1 rounded-full border border-gold/20">${escapeHtml(product.category || 'ALORA RADIANCE')}</span>`);
    html = html.replace(/<h1 id="product-title"[^>]*>.*?<\/h1>/i, `<h1 id="product-title" class="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-ink mt-3 leading-tight">${escapeHtml(product.name)}</h1>`);
    html = html.replace(/<span id="reviews-count">.*?<\/span>/i, `<span id="reviews-count">${product.numReviews || 0}</span>`);

    // Pricing
    html = html.replace(/<span id="product-price"[^>]*>.*?<\/span>/i, `<span id="product-price" class="text-2xl sm:text-3xl font-serif font-bold text-clay">₹ ${price}</span>`);
    if (mrp && mrp > price) {
        html = html.replace(/<span id="product-mrp"[^>]*>.*?<\/span>/i, `<span id="product-mrp" class="text-sm sm:text-base text-ash line-through">₹ ${mrp}</span>`);
        const pct = Math.round(((mrp - price) / mrp) * 100);
        html = html.replace(/<span id="product-discount-badge"[^>]*>.*?<\/span>/i, `<span id="product-discount-badge" class="bg-amber-100 text-clay text-xs font-bold px-2.5 py-0.5 rounded-md border border-clay/20 font-mono">SAVE ${pct}%</span>`);
    } else {
        html = html.replace(/<span id="product-mrp"[^>]*>.*?<\/span>/i, `<span id="product-mrp" class="text-sm sm:text-base text-ash line-through"></span>`);
        html = html.replace(/<span id="product-discount-badge"[^>]*>.*?<\/span>/i, `<span id="product-discount-badge" class="hidden"></span>`);
    }

    // Short Description & Details
    html = html.replace(/<p id="product-desc"[^>]*>[\s\S]*?<\/p>/i, `<p id="product-desc" class="text-sm text-ash leading-relaxed">${escapeHtml(product.description || '')}</p>`);

    // Variants HTML Pre-render
    if (product.variants && product.variants.length > 0) {
        const variantsButtons = product.variants.map((v, idx) => {
            const isActive = idx === 0;
            const activeClasses = isActive 
                ? 'border-2 border-ink bg-ink text-parchment font-semibold' 
                : 'border border-[#DCD3BA] text-ash font-semibold hover:border-ink';
            return `
                <button 
                    onclick="selectSize('${v.volume}', ${v.price}, ${v.comparePrice || 0}, ${v.stock || 0}, this)"
                    class="size-btn text-sm px-4 py-2 rounded-full transition ${activeClasses}"
                >
                    ${escapeHtml(v.volume)}
                </button>
            `;
        }).join('');
        html = html.replace(/<div id="variants-container"[^>]*>[\s\S]*?<\/div>/i, `<div id="variants-container" class="flex flex-wrap gap-2.5">${variantsButtons}</div>`);
    }

    // Additional Detail Sections
    if (product.details) {
        html = html.replace(/<p id="product-details"[^>]*>[\s\S]*?<\/p>/i, `<p id="product-details" class="text-sm text-ash leading-relaxed">${escapeHtml(product.details)}</p>`);
    }
    if (product.benefits) {
        html = html.replace(/<p id="product-benefits"[^>]*>[\s\S]*?<\/p>/i, `<p id="product-benefits" class="text-sm text-ash leading-relaxed">${escapeHtml(product.benefits)}</p>`);
    }
    if (product.usageInstructions) {
        html = html.replace(/<p id="product-usage"[^>]*>[\s\S]*?<\/p>/i, `<p id="product-usage" class="text-sm text-ash leading-relaxed">${escapeHtml(product.usageInstructions)}</p>`);
    }
    if (product.ingredients) {
        html = html.replace(/<p id="product-ingredients"[^>]*>[\s\S]*?<\/p>/i, `<p id="product-ingredients" class="text-sm text-ash leading-relaxed">${escapeHtml(product.ingredients)}</p>`);
    }

    return html;
};

// ==========================================
// 4. PRODUCT CATALOG LISTING SSR PRE-RENDERER
// ==========================================
export const renderProductListSsr = (templateHtml, products = []) => {
    let html = templateHtml;

    const title = "Shop Premium Skincare Products | Alora Radiance";
    const desc = "Explore our luxury collection of dermatologically tested face washes, serums, scrubs, and creams formulated with pure botanicals and active essentials.";
    const canonical = `${DOMAIN}/products`;

    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${desc}">`);
    html = html.replace(/<link rel="canonical" href="[^"]*" \/>/i, `<link rel="canonical" href="${canonical}" />`);

    // Filter Skeleton to Filter Content Toggle
    html = html.replace(/<div id="filter-skeleton" class="space-y-6">/i, `<div id="filter-skeleton" class="space-y-6 hidden">`);
    html = html.replace(/<div id="filter-content" class="hidden\s+/i, `<div id="filter-content" class="`);

    if (Array.isArray(products) && products.length > 0) {
        const cardsHtml = products.map(product => {
            const pUrl = getProductSlugUrl(product);
            const pImg = formatImageUrl(product.imagepath);
            const firstVariant = (product.variants && product.variants.length > 0) ? product.variants[0] : null;
            const price = firstVariant ? firstVariant.price : (product.price || 0);
            const mrp = firstVariant ? firstVariant.comparePrice : (product.comparePrice || 0);
            let pctBadge = '';
            if (mrp && mrp > price) {
                const pct = Math.round(((mrp - price) / mrp) * 100);
                if (pct > 0) {
                    pctBadge = `<span class="discount-badge text-[9px] sm:text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-200 uppercase font-mono">${pct}% OFF</span>`;
                }
            }
            const starsHtml = generateStarsHtml(product.rating);

            return `
                <div class="bg-white rounded-2xl p-4 border border-[#ECE4CE] shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <a href="${pUrl}" class="block aspect-square rounded-xl overflow-hidden mb-3 bg-amber-50/50 relative">
                        <img src="${pImg}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover hover:scale-105 transition duration-300" loading="lazy">
                    </a>
                    <div>
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-[10px] font-bold text-[#8B4513] uppercase tracking-wider">${escapeHtml(product.category || 'SKINCARE')}</span>
                            ${pctBadge}
                        </div>
                        <h3 class="font-fraunces font-bold text-slate-900 text-sm line-clamp-1 mb-1">
                            <a href="${pUrl}" class="hover:text-[#8B4513] transition">${escapeHtml(product.name)}</a>
                        </h3>
                        <div class="flex items-center gap-1.5 mb-2 text-xs">
                            <div class="flex text-amber-500">${starsHtml}</div>
                            <span class="text-[10px] text-slate-400 font-mono">(${product.rating || 4.5})</span>
                        </div>
                        <div class="flex items-baseline gap-2 mb-3">
                            <span class="text-base font-bold text-slate-900 font-serif">₹${price}</span>
                            ${mrp ? `<span class="text-xs text-slate-400 line-through">₹${mrp}</span>` : ''}
                        </div>
                    </div>
                    <a href="${pUrl}" class="w-full text-center bg-amber-100 hover:bg-[#8B4513] text-[#8B4513] hover:text-white font-bold text-xs py-2.5 rounded-xl transition">
                        View Product
                    </a>
                </div>
            `;
        }).join('');

        html = html.replace(/<span id="results-count"[^>]*>.*?<\/span>/i, `<span id="results-count" class="text-sm font-medium text-ash">Showing ${products.length} products</span>`);
        html = html.replace(/<div id="product-grid"[^>]*>[\s\S]*?<\/div>/i, `<div id="product-grid" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">${cardsHtml}</div>`);
    }

    return html;
};
