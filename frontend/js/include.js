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
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} not found (status ${res.status})`);
        el.innerHTML = await res.text();
    } catch (err) {
        console.error("Partial load failed:", url, err);
    }
}
async function loadAllPartials() {
    const isFile = location.protocol === "file:";
    const navUrl = isFile ? "./navbar.html" : "/navbar.html";
    const footerUrl = isFile ? "./footer.html" : "/footer.html";
    const chatbotUrl = isFile ? "./chatbot.html" : "/chatbot.html";
    const chatbotJsUrl = isFile ? "./js/chatbot.js" : "/js/chatbot.js";
    await Promise.all([
        loadPartial("#navbar-placeholder", navUrl),
        loadPartial("#footer-placeholder", footerUrl),
    ]);
    await loadPartial("#chatbot-placeholder", chatbotUrl);
    if (!document.getElementById("alora-chatbot-js")) {
        const script = document.createElement("script");
        script.id = "alora-chatbot-js";
        script.src = chatbotJsUrl;
        document.body.appendChild(script);
    }
    document.dispatchEvent(new Event("partialsLoaded"));
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
    if (!code) return;
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
window.parseMultipleSchemas = function(rawInput) {
    if (!rawInput || !String(rawInput).trim()) return [];
    let cleaned = String(rawInput).trim();
    if (cleaned.includes('<script')) {
        const scriptMatches = cleaned.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches && scriptMatches.length > 0) {
            const extracted = [];
            for (const match of scriptMatches) {
                const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
                if (content) {
                    const subSchemas = window.parseMultipleSchemas(content);
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
};
window.injectMultipleSchemasToDOM = function(rawSchemaInput) {
    document.querySelectorAll('.dynamic-schema-injected, #dynamic-json-ld').forEach(el => el.remove());
    if (!rawSchemaInput || !String(rawSchemaInput).trim()) return;
    let schemasToInject = window.parseMultipleSchemas(rawSchemaInput);
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
};
(function initRakhiCountdown() {
    function updateRakhiTimer() {
        const daysEl = document.getElementById('rakhi-days');
        const hoursEl = document.getElementById('rakhi-hours');
        const minsEl = document.getElementById('rakhi-minutes');
        const secsEl = document.getElementById('rakhi-seconds');
        if (!hoursEl || !minsEl || !secsEl) return;
        const rakhiTarget = new Date('2026-08-28T23:59:59+05:30');
        const now = new Date();
        let diff = Math.max(0, Math.floor((rakhiTarget - now) / 1000));
        const days = Math.floor(diff / (3600 * 24));
        const hours = Math.floor((diff % (3600 * 24)) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minsEl.textContent = String(minutes).padStart(2, '0');
        secsEl.textContent = String(seconds).padStart(2, '0');
    }
    setInterval(updateRakhiTimer, 1000);
    document.addEventListener('DOMContentLoaded', updateRakhiTimer);
    document.addEventListener('partialsLoaded', updateRakhiTimer);
    updateRakhiTimer();
})();
window.showReferralBanner = showReferralBanner;
window.loadGtmScript = loadGtmScript;
initGoogleTagManager();
trackReferralFromUrl();
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAllPartials);
} else {
    loadAllPartials();
}