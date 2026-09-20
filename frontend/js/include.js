window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn ? btn.querySelector('i') : null;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

window.appendSchemaTemplate = function(type) {
    const textarea = document.getElementById('schema');
    if (!textarea) return;
    const templates = {
        article: {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": "Blog Title Here",
            "description": "Short summary of the blog post.",
            "author": { "@type": "Organization", "name": "Alora Radiance" }
        },
        faq: {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "What are the benefits of this product?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Detailed answer explaining the benefits." }
                }
            ]
        },
        howto: {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to apply product effectively",
            "step": [
                { "@type": "HowToStep", "text": "Cleanse face gently with lukewarm water." },
                { "@type": "HowToStep", "text": "Apply 3 drops of serum and massage evenly." }
            ]
        }
    };
    const newObj = templates[type] || templates.article;
    const currentVal = textarea.value.trim();
    if (!currentVal) {
        textarea.value = JSON.stringify([newObj], null, 2);
    } else {
        try {
            let parsed = JSON.parse(currentVal);
            if (Array.isArray(parsed)) {
                parsed.push(newObj);
            } else if (typeof parsed === 'object' && parsed !== null) {
                parsed = [parsed, newObj];
            } else {
                parsed = [newObj];
            }
            textarea.value = JSON.stringify(parsed, null, 2);
        } catch (e) {
            textarea.value = JSON.stringify([newObj], null, 2);
        }
    }
};

async function loadPartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return; 
    try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`${url} not found (status ${res.status})`);
        const html = await res.text();
        el.innerHTML = html;
        if (location.protocol !== "file:") {
            el.querySelectorAll('img[src^="./static/"]').forEach(img => {
                img.src = img.getAttribute('src').replace(/^\.\/static\//, '/static/');
            });
        }
    } catch (err) {
        console.error("Partial load failed:", url, err);
    }
}

async function refreshPageFaqs() {
    const container = document.getElementById('global-faq-list');
    if (!container) return;

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const baseUrl = (window.BASE_URL !== undefined && window.BASE_URL !== null) ? window.BASE_URL : (isLocal ? "http://localhost:5000" : "");

    let pageCategory = "Landing Page";
    const path = (window.location.pathname || "").toLowerCase();

    if (path.includes("about") || path.includes("aboutus")) {
        pageCategory = "About Us";
    } else if (path.includes("product") || path.includes("moreproduct") || path.includes("cart") || path.includes("shop")) {
        pageCategory = "Shop / Products";
    } else if (path.includes("blog") || path.includes("post")) {
        pageCategory = "Blog Page";
    } else {
        pageCategory = "Landing Page";
    }

    const customSlot = document.querySelector("[data-faq-page]");
    if (customSlot && customSlot.getAttribute("data-faq-page")) {
        pageCategory = customSlot.getAttribute("data-faq-page");
    }

    try {
        const res = await fetch(`${baseUrl}/api/faqs?page=${encodeURIComponent(pageCategory)}`, { cache: "no-cache" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
            container.innerHTML = data.data.map((faq, idx) => {
                const isOpen = idx === 0 ? "open" : "";
                return `
                    <details class="group bg-white hover:bg-[#FAF7F0] p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-[#ECE4CE] shadow-2xs transition-all duration-300 open:shadow-md open:bg-white" ${isOpen}>
                        <summary class="flex justify-between items-center font-sans font-semibold text-slate-900 text-xs sm:text-sm md:text-base cursor-pointer list-none select-none gap-3">
                            <span class="leading-snug flex-1">${faq.question}</span>
                            <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100/90 text-[#8B4513] flex items-center justify-center text-xs group-open:rotate-45 transition-transform shrink-0"><i class="fa-solid fa-plus"></i></span>
                        </summary>
                        <p class="text-xs sm:text-sm text-slate-600 mt-3 pt-3 border-t border-[#ECE4CE]/80 leading-relaxed font-sans font-normal">
                            ${faq.answer}
                        </p>
                    </details>
                `;
            }).join('');
        }
    } catch (err) {
        // keep fallback HTML if fetch fails
    }
}
window.refreshPageFaqs = refreshPageFaqs;

async function loadAllPartials() {
    const isFile = location.protocol === "file:";
    const navUrl = isFile ? "./navbar.html" : "/navbar.html";
    const footerUrl = isFile ? "./footer.html" : "/footer.html";
    const faqUrl = isFile ? "./faq-section.html" : "/faq-section.html";
    const chatbotUrl = isFile ? "./chatbot.html" : "/chatbot.html";
    const chatbotJsUrl = isFile ? "./js/chatbot.js" : "/js/chatbot.js";

    const navPlaceholder = document.getElementById('navbar-placeholder');
    if (navPlaceholder) {
        if (!navPlaceholder.parentElement || navPlaceholder.parentElement.tagName !== 'HEADER') {
            navPlaceholder.classList.add('sticky', 'top-0', 'z-50', 'w-full', 'bg-white');
        }
        await loadPartial("#navbar-placeholder", navUrl);
        if (typeof window.renderNavbarState === 'function') {
            window.renderNavbarState();
        }
    }

    const loadDeferredPartials = async () => {
        // Auto-inject and load FAQ section across all public customer pages
        // (Excluding single blog post pages, as requested)
        const footerPlaceholder = document.getElementById('footer-placeholder');
        const pathname = (window.location.pathname || "").toLowerCase();
        const isAdminOrAuth = pathname.includes('admin') || pathname.includes('login') || pathname.includes('register') || pathname.includes('forgot') || pathname.includes('reset');
        const hasProductFaq = !!document.getElementById('product-faq-section');
        const isSingleBlogPage = !!document.getElementById('blog-content-area') || !!document.getElementById('post-loader') || pathname.includes('post.html') || (/^\/blogs?\/[^\/]+/i.test(pathname) && !pathname.endsWith('/blog') && !pathname.endsWith('/blogs') && !pathname.endsWith('/blog.html'));
        
        let faqPlaceholder = document.getElementById('faq-placeholder');
        if (!faqPlaceholder && footerPlaceholder && !isAdminOrAuth && !hasProductFaq && !isSingleBlogPage) {
            faqPlaceholder = document.createElement('div');
            faqPlaceholder.id = 'faq-placeholder';
            footerPlaceholder.parentNode.insertBefore(faqPlaceholder, footerPlaceholder);
        }

        if (faqPlaceholder && !isSingleBlogPage) {
            await loadPartial("#faq-placeholder", faqUrl);
            await refreshPageFaqs();
        } else if (faqPlaceholder && isSingleBlogPage) {
            faqPlaceholder.remove();
        }

        await loadPartial("#footer-placeholder", footerUrl);
        await loadPartial("#chatbot-placeholder", chatbotUrl);
        if (!document.getElementById("alora-chatbot-js")) {
            const script = document.createElement("script");
            script.id = "alora-chatbot-js";
            script.src = chatbotJsUrl;
            document.body.appendChild(script);
        }
        document.dispatchEvent(new Event("partialsLoaded"));
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadDeferredPartials();
    } else {
        document.addEventListener('DOMContentLoaded', loadDeferredPartials, { once: true });
        window.addEventListener('load', loadDeferredPartials, { once: true });
    }
}

function loadGtmScript(gtmId) {
    if (!gtmId || !/^GTM-[A-Z0-9]+$/i.test(gtmId.trim())) return;
    const cleanId = gtmId.trim().toUpperCase();
    if (window._gtmInitialized === cleanId) return;
    window._gtmInitialized = cleanId;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        'gtm.start': new Date().getTime(),
        event: 'gtm.js'
    });
    const headScript = document.createElement("script");
    headScript.async = true;
    headScript.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(cleanId)}`;
    document.head.appendChild(headScript);
    const noscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(cleanId)}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.cssText = "display:none;visibility:hidden";
    noscript.appendChild(iframe);
    if (document.body) {
        document.body.insertBefore(noscript, document.body.firstChild);
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            document.body.insertBefore(noscript, document.body.firstChild);
        });
    }
}

function initGoogleTagManager() {
    if (window.GTM_ID) {
        loadGtmScript(window.GTM_ID);
        return;
    }
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const baseUrl = (window.BASE_URL !== undefined && window.BASE_URL !== null) 
        ? window.BASE_URL 
        : (isLocal ? "http://localhost:5000" : "");
    fetch(`${baseUrl}/api/config/gtm`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
            if (data?.gtmId) {
                loadGtmScript(data.gtmId);
            }
        })
        .catch(() => {});
}

function showReferralBanner(code, discountPercent) {
    if (!code || window.self !== window.top) return;
    let banner = document.getElementById("alora-referral-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "alora-referral-banner";
        banner.className = "bg-[#8B4513] text-white text-xs py-2.5 px-4 text-center font-medium flex items-center justify-center gap-2 relative z-50 shadow-md border-b border-amber-900/40";
        document.body.prepend(banner);
    }
    banner.innerHTML = `
        <span>🎉 <strong>Special Offer Active!</strong> Referral Code <span class="font-mono bg-white/20 px-1.5 py-0.5 rounded font-bold">${code}</span> applied — <strong>${discountPercent}% OFF</strong> on your order!</span>
        <button onclick="document.getElementById('alora-referral-banner').remove()" class="ml-2 text-white/80 hover:text-white text-sm focus:outline-none" title="Dismiss">&times;</button>
    `;
}

function trackReferralFromUrl() {
    if (window.self !== window.top) return;
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/ref\/([^/?#]+)\/?$/i);
    const rawCode = pathMatch?.[1] || params.get("ref") || params.get("aff") || params.get("referral") || params.get("code") || params.get("affiliate");
    if (!rawCode || !/^[a-z0-9_-]{5,64}$/i.test(rawCode)) {
        try {
            const stored = JSON.parse(sessionStorage.getItem("aloraReferral") || "null");
            if (stored && stored.referralCode) {
                showReferralBanner(stored.referralCode, stored.discountPercent || 10);
            }
        } catch (e) {}
        return;
    }
    const normalizedCode = rawCode.toUpperCase();
    let existing = null;
    try { existing = JSON.parse(sessionStorage.getItem("aloraReferral") || "null"); } catch {  }
    if (existing?.referralCode === normalizedCode && existing?.clickId) {
        showReferralBanner(normalizedCode, existing.discountPercent || 10);
        return;
    }
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const baseUrl = (window.BASE_URL !== undefined && window.BASE_URL !== null) 
        ? window.BASE_URL 
        : (isLocal ? "http://localhost:5000" : "");
    fetch(`${baseUrl}/api/affiliates/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, landingPage: `${location.pathname}${location.search}` })
    }).then(async (response) => {
        if (!response.ok) {
            sessionStorage.removeItem("aloraReferral");
            const existingBanner = document.getElementById("alora-referral-banner");
            if (existingBanner) existingBanner.remove();
            console.warn(`Referral code '${normalizedCode}' is invalid or inactive.`);
            return;
        }
        const data = await response.json();
        const clickId = data.clickId || null;
        const discountPercent = Number(data.discountPercent) || 0;
        if (!clickId || discountPercent <= 0) throw new Error("Affiliate tracking response was incomplete.");
        sessionStorage.setItem("aloraReferral", JSON.stringify({
            referralCode: normalizedCode,
            clickId,
            discountPercent
        }));
        showReferralBanner(normalizedCode, discountPercent);
        if (typeof window.recalculateBill === "function") {
            window.recalculateBill();
        }
    }).catch((error) => {
        console.warn("Referral tracking network notice:", error.message);
    });
}

function deduplicateSchemas(schemas) {
    if (!Array.isArray(schemas)) return [];
    const seenExact = new Set();
    const singletonMap = new Map();
    const others = [];
    const SINGLETON_TYPES = ['Product', 'BlogPosting', 'Article', 'NewsArticle', 'BreadcrumbList', 'FAQPage', 'WebSite', 'Organization', 'ItemPage', 'WebPage'];

    for (const s of schemas) {
        if (!s || typeof s !== 'object') continue;
        const key = JSON.stringify(s);
        if (seenExact.has(key)) continue;
        seenExact.add(key);

        const type = s['@type'];
        const isSingleton = typeof type === 'string' && SINGLETON_TYPES.includes(type);

        if (isSingleton) {
            if (!singletonMap.has(type)) {
                singletonMap.set(type, s);
            } else {
                const existing = singletonMap.get(type);
                const merged = { ...existing, ...s };
                if (existing.offers && s.offers && typeof existing.offers === 'object' && typeof s.offers === 'object') {
                    merged.offers = { ...existing.offers, ...s.offers };
                }
                if (existing.aggregateRating && s.aggregateRating && typeof existing.aggregateRating === 'object' && typeof s.aggregateRating === 'object') {
                    merged.aggregateRating = { ...existing.aggregateRating, ...s.aggregateRating };
                }
                if (type === 'FAQPage' && existing.mainEntity && s.mainEntity) {
                    const combined = [
                        ...(Array.isArray(existing.mainEntity) ? existing.mainEntity : [existing.mainEntity]),
                        ...(Array.isArray(s.mainEntity) ? s.mainEntity : [s.mainEntity])
                    ];
                    const qSeen = new Set();
                    merged.mainEntity = combined.filter(q => {
                        const qKey = q?.name || q?.question || JSON.stringify(q);
                        if (qSeen.has(qKey)) return false;
                        qSeen.add(qKey);
                        return true;
                    });
                }
                singletonMap.set(type, merged);
            }
        } else {
            others.push(s);
        }
    }
    return [...singletonMap.values(), ...others];
}

function repairSchemaString(rawInput) {
    if (!rawInput) return "";
    let s = String(rawInput).trim();
    if (!s) return "";

    s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/gi, "'");
    s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"').replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

    s = s.replace(/\[\s*([^\[\]\r\n]+?)\s*\]\(\s*([^()\s]+?)\s*\)/g, (match, text, href) => {
        let clean = href.trim();
        if (clean.endsWith(',')) clean = clean.slice(0, -1).trim();
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
            return '"' + clean + '"';
        }
        return '"' + text.trim() + '"';
    });

    s = s.replace(/("([^"\\]|\\.)*"|'([^'\\]|\\.)*')|(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/g, (match, strVal) => {
        if (strVal) return strVal;
        return "";
    });

    s = s.replace(/(^|[{,\[])(\s*)([@a-zA-Z_$][a-zA-Z0-9_$-]*)\s*:/g, '$1$2"$3":');
    s = s.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (match, p1) => ': "' + p1.replace(/"/g, '\\"') + '"');
    s = s.replace(/("|\}|\]|\d|true|false|null)\s*[\r\n]+\s*("|\{|\[)/g, '$1,\n$2');
    s = s.replace(/,(\s*[}\]])/g, '$1');

    return s.trim();
}

function parseMultipleSchemas(rawInput) {
    if (!rawInput) return [];
    if (Array.isArray(rawInput)) {
        return deduplicateSchemas(rawInput.filter(item => item && typeof item === 'object'));
    }
    if (typeof rawInput === 'object' && rawInput !== null) {
        if (Array.isArray(rawInput['@graph'])) {
            return deduplicateSchemas(rawInput['@graph'].filter(item => item && typeof item === 'object'));
        }
        return [rawInput];
    }
    let cleaned = String(rawInput).trim();
    if (!cleaned) return [];

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
            if (extracted.length > 0) return deduplicateSchemas(extracted);
        } else {
            cleaned = cleaned.replace(/<[^>]*>/g, '').trim();
        }
    }

    cleaned = repairSchemaString(cleaned);
    if (!cleaned) return [];

    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return deduplicateSchemas(parsed.filter(item => item && typeof item === 'object'));
        }
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed['@graph'])) {
                return deduplicateSchemas(parsed['@graph'].filter(item => item && typeof item === 'object'));
            }
            return [parsed];
        }
    } catch (e) {}

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
                    const repairedChunk = repairSchemaString(jsonChunk);
                    try {
                        const parsedObj = JSON.parse(repairedChunk);
                        if (Array.isArray(parsedObj)) {
                            schemas.push(...parsedObj.filter(item => item && typeof item === 'object'));
                        } else if (parsedObj && typeof parsedObj === 'object') {
                            if (Array.isArray(parsedObj['@graph'])) {
                                schemas.push(...parsedObj['@graph'].filter(item => item && typeof item === 'object'));
                            } else {
                                schemas.push(parsedObj);
                            }
                        }
                    } catch (err) {
                        console.warn("Failed parsing schema chunk:", err);
                    }
                    startIndex = -1;
                }
            }
        }
    }
    return deduplicateSchemas(schemas);
}

function injectMultipleSchemasToDOM(rawSchemaInput) {
    document.querySelectorAll('.dynamic-schema-injected, #dynamic-json-ld, script[type="application/ld+json"]').forEach(el => el.remove());
    if (!rawSchemaInput) return;
    let schemasToInject = parseMultipleSchemas(rawSchemaInput);
    if (!schemasToInject || schemasToInject.length === 0) return;

    const script = document.createElement('script');
    script.id = 'dynamic-json-ld';
    script.type = 'application/ld+json';
    script.className = 'dynamic-schema-injected';
    script.setAttribute('data-dynamic', 'true');

    if (schemasToInject.length === 1) {
        const single = { ...schemasToInject[0] };
        if (!single["@context"]) single["@context"] = "https://schema.org";
        script.textContent = JSON.stringify(single, null, 2);
    } else {
        const combinedSchema = {
            "@context": "https://schema.org",
            "@graph": schemasToInject.map(s => {
                const copy = { ...s };
                if (copy["@context"]) delete copy["@context"];
                return copy;
            })
        };
        script.textContent = JSON.stringify(combinedSchema, null, 2);
    }
    document.head.appendChild(script);
}

window.parseMultipleSchemas = parseMultipleSchemas;
window.injectMultipleSchemasToDOM = injectMultipleSchemasToDOM;
window.showReferralBanner = showReferralBanner;
window.loadGtmScript = loadGtmScript;

const initNonCriticalServices = () => {
    initGoogleTagManager();
    trackReferralFromUrl();
};

loadAllPartials();

// GTM and referral tracking may inject third-party scripts. Do not let an early
// idle period compete with the page's first render or responsiveness window.
window.addEventListener('load', () => {
    setTimeout(initNonCriticalServices, 3000);
}, { once: true });
