

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

function trackReferralFromUrl() {
    const referralCode = new URLSearchParams(window.location.search).get("ref");
    if (!referralCode || !/^[a-z0-9_-]{5,64}$/i.test(referralCode)) return;
    const normalizedCode = referralCode.toUpperCase();
    let existing = null;
    try { existing = JSON.parse(sessionStorage.getItem("aloraReferral") || "null"); } catch { /* replace unreadable storage */ }
    const clickId = existing?.referralCode === normalizedCode && existing?.clickId
        ? existing.clickId
        : (window.crypto?.randomUUID?.().replace(/-/g, "") || `${Date.now()}${Math.random().toString(36).slice(2)}`);
    const baseUrl = (location.hostname === "localhost" || location.hostname === "127.0.0.1") ? `${location.protocol}//${location.hostname}:5000` : "";
    fetch(`${baseUrl}/api/affiliates/track-click`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, clickId, landingPage: `${location.pathname}${location.search}` })
    }).then((response) => {
        if (!response.ok) throw new Error("Referral code is invalid or inactive.");
        sessionStorage.setItem("aloraReferral", JSON.stringify({ referralCode: normalizedCode, clickId }));
    }).catch((error) => console.warn("Referral tracking skipped:", error.message));
}

trackReferralFromUrl();
document.addEventListener("DOMContentLoaded", loadAllPartials);
