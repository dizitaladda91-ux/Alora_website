

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

const REFERRAL_STORAGE_KEY = "aloraReferral";
const REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getStoredReferral() {
    let referral = null;
    try {
        const raw = localStorage.getItem(REFERRAL_STORAGE_KEY) || sessionStorage.getItem(REFERRAL_STORAGE_KEY);
        referral = raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
        return null;
    }

    if (!referral?.referralCode) return null;
    if (referral.expiresAt && Number(referral.expiresAt) < Date.now()) {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
        return null;
    }

    if (!referral.expiresAt) {
        referral.expiresAt = Date.now() + REFERRAL_TTL_MS;
        localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referral));
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
    return referral;
}

function storeReferral(referral) {
    const value = { ...referral, capturedAt: Date.now(), expiresAt: Date.now() + REFERRAL_TTL_MS };
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(value));
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
    return value;
}

window.getAloraReferral = getStoredReferral;

function showReferralBanner(referral) {
    const code = String(referral?.referralCode || "").trim().toUpperCase();
    const discountPercent = Number(referral?.discountPercent || 0);
    if (!code || !Number.isFinite(discountPercent) || discountPercent <= 0 || document.getElementById("alora-referral-banner")) return;

    const banner = document.createElement("div");
    banner.id = "alora-referral-banner";
    banner.className = "fixed left-1/2 top-4 z-[99999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-lg";
    const text = document.createElement("span");
    text.textContent = `Referral ${code} applied — ${discountPercent}% off at checkout.`;
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close referral message");
    closeButton.className = "ml-3 text-lg leading-none";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => banner.remove());
    banner.append(text, closeButton);
    document.body.appendChild(banner);
}

function showStoredReferralBanner() {
    try {
        showReferralBanner(getStoredReferral());
    } catch {
        // Ignore malformed browser storage.
    }
}

function trackReferralFromUrl() {
    const referralCode = new URLSearchParams(window.location.search).get("ref");
    if (!referralCode || !/^[a-z0-9_-]{5,64}$/i.test(referralCode)) return;
    const normalizedCode = referralCode.toUpperCase();
    const existing = getStoredReferral();
    const clickId = existing?.referralCode === normalizedCode && existing?.clickId
        ? existing.clickId
        : (window.crypto?.randomUUID?.().replace(/-/g, "") || `${Date.now()}${Math.random().toString(36).slice(2)}`);
    const baseUrl = (location.hostname === "localhost" || location.hostname === "127.0.0.1") ? `${location.protocol}//${location.hostname}:5000` : "";
    fetch(`${baseUrl}/api/affiliates/track-click`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, clickId, landingPage: `${location.pathname}${location.search}` })
    }).then(async (response) => {
        if (!response.ok) throw new Error("Referral code is invalid or inactive.");
        const data = await response.json();
        const detail = storeReferral({ referralCode: normalizedCode, clickId, discountPercent: Number(data.discountPercent || 0) });
        document.dispatchEvent(new CustomEvent("alora:referral-ready", { detail }));
        showReferralBanner(detail);
    }).catch((error) => console.warn("Referral tracking skipped:", error.message));
}

trackReferralFromUrl();
document.addEventListener("alora:referral-ready", (event) => showReferralBanner(event.detail));
document.addEventListener("DOMContentLoaded", () => {
    showStoredReferralBanner();
    loadAllPartials();
});
