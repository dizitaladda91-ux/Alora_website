import BASE_URL, { getAuthHeaders } from "./config.js";

async function getCurrentSession() {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/session`, { 
            headers: getAuthHeaders(),
            credentials: "include" 
        });
        if (!response.ok) return null;

        const data = await response.json();
        return data.success ? data.user : null;
    } catch {
        return null;
    }
}

async function protectSeoPage() {
    const isTabActive = sessionStorage.getItem("tabAuthActive");
    const role = sessionStorage.getItem("userRole");

    // Enforce strict single-tab session scope for SEO Studio
    if (!isTabActive || (role !== "seoadmin" && role !== "admin")) {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("userToken");
        window.location.replace("./login.html");
        return;
    }

    const user = await getCurrentSession();
    if (!user || (user.role !== "seoadmin" && user.role !== "admin")) {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("userToken");
        window.location.replace("./login.html");
        return;
    }

    sessionStorage.setItem("user", JSON.stringify(user));
}

function clearAllAuthStorageAndRedirect() {
    sessionStorage.clear();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("tabAuthActive");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("seo_token");
    window.location.replace("./login.html");
}

async function handleSeoLogout(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    try {
        await fetch(`${BASE_URL}/api/auth/logout`, { 
            method: "POST", 
            headers: getAuthHeaders(),
            credentials: "include" 
        });
    } catch (err) {
        console.warn("Logout request failed:", err);
    } finally {
        clearAllAuthStorageAndRedirect();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    protectSeoPage();
});

document.addEventListener("click", (event) => {
    const logoutBtn = event.target.closest("#adminLogoutBtn, #logout-btn, #seoLogoutBtn, .seo-logout-btn");
    if (logoutBtn) {
        handleSeoLogout(event);
    }
});

