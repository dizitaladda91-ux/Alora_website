async function loadPartial(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return; // us page par placeholder hi nahi hai to skip

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} not found (status ${res.status})`);
        el.innerHTML = await res.text();
    } catch (err) {
        console.error("Partial load failed:", url, err);
    }
}

async function loadAllPartials() {
    // Navbar aur footer dono parallel me load honge (fast)
    await Promise.all([
        loadPartial("#navbar-placeholder", "./navbar.html"),
        loadPartial("#footer-placeholder", "./footer.html"),
    ]);
    document.dispatchEvent(new Event("partialsLoaded"));
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
    const rawCode = params.get("ref") || params.get("aff") || params.get("referral") || params.get("code") || params.get("affiliate");
    if (!rawCode || !/^[a-z0-9_-]{5,64}$/i.test(rawCode)) {
        // No ref/aff parameter in current URL, check if previous referral is stored in session
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
    try { existing = JSON.parse(sessionStorage.getItem("aloraReferral") || "null"); } catch { /* replace unreadable storage */ }
    const clickId = existing?.referralCode === normalizedCode && existing?.clickId
        ? existing.clickId
        : (window.crypto?.randomUUID?.().replace(/-/g, "") || `${Date.now()}${Math.random().toString(36).slice(2)}`);

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:";
    const baseUrl = isLocal ? "http://localhost:5000" : "";

    fetch(`${baseUrl}/api/affiliates/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, clickId, landingPage: `${location.pathname}${location.search}` })
    }).then(async (response) => {
        if (!response.ok) throw new Error("Referral code is invalid or inactive.");
        const data = await response.json();
        const discountPercent = Number(data.discountPercent) || 10;
        sessionStorage.setItem("aloraReferral", JSON.stringify({
            referralCode: normalizedCode,
            clickId,
            discountPercent
        }));
        showReferralBanner(normalizedCode, discountPercent);
        if (typeof window.recalculateBill === "function") {
            window.recalculateBill();
        }
    }).catch((error) => console.warn("Referral tracking skipped:", error.message));
}

window.showReferralBanner = showReferralBanner;
trackReferralFromUrl();
document.addEventListener("DOMContentLoaded", loadAllPartials);
