

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

function loadAffiliateStorefrontScript() {
    window.addEventListener("alora:referral-ready", ({ detail }) => {
        try {
            sessionStorage.setItem("aloraReferral", JSON.stringify(detail));
        } catch (error) {
            console.warn("Referral session could not be saved.", error);
        }
    });

    if (document.getElementById("alora-affiliate-storefront-script")) return;

    const script = document.createElement("script");
    script.id = "alora-affiliate-storefront-script";
    script.src = "https://aloraaffilation.onrender.com/alora-storefront-discount.js";
    script.defer = true;
    document.head.appendChild(script);
}

loadAffiliateStorefrontScript();
document.addEventListener("DOMContentLoaded", loadAllPartials);
