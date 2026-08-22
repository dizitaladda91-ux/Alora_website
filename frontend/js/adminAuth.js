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

async function protectAdminPage() {
    const isTabActive = sessionStorage.getItem("tabAuthActive");
    const role = sessionStorage.getItem("userRole");

    // Enforce strict single-tab session scope for Admin Portal
    if (!isTabActive || role !== "admin") {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("userToken");
        window.location.replace("./login.html");
        return;
    }

    const user = await getCurrentSession();
    if (!user || user.role !== "admin") {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("userToken");
        window.location.replace("./login.html");
        return;
    }

    sessionStorage.setItem("user", JSON.stringify(user));
    const welcomeText = document.querySelector("main h2");
    if (welcomeText && user.name) {
        welcomeText.innerHTML = `Hello ${user.name.toUpperCase()}`;
    }
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

async function handleAdminLogout(event) {
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
    protectAdminPage();
});

document.addEventListener("click", (event) => {
    const logoutBtn = event.target.closest("#adminLogoutBtn, #logout-btn, #seoLogoutBtn, .seo-logout-btn");
    if (logoutBtn) {
        handleAdminLogout(event);
    }
});

