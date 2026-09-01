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
    const role = sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
    const storedUserStr = sessionStorage.getItem("user") || localStorage.getItem("user");

    let storedUser = null;
    try {
        if (storedUserStr) storedUser = JSON.parse(storedUserStr);
    } catch (e) {}

    const isRoleValid = role === "admin" || (storedUser && storedUser.role === "admin");

    sessionStorage.setItem("tabAuthActive", "true");
    if (role) sessionStorage.setItem("userRole", role);
    if (storedUserStr) sessionStorage.setItem("user", storedUserStr);

    const freshUser = await getCurrentSession();
    if (freshUser && freshUser.role === "admin") {
        sessionStorage.setItem("user", JSON.stringify(freshUser));
        sessionStorage.setItem("userRole", freshUser.role);
        localStorage.setItem("user", JSON.stringify(freshUser));
        localStorage.setItem("userRole", freshUser.role);
        storedUser = freshUser;
    } else if (!isRoleValid) {
        clearAllAuthStorageAndRedirect();
        return;
    }

    const welcomeText = document.querySelector("main h2");
    if (welcomeText && storedUser?.name) {
        welcomeText.innerHTML = `Hello ${storedUser.name.toUpperCase()}`;
    }
}
function clearAllAuthStorageAndRedirect() {
    sessionStorage.clear();
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    localStorage.removeItem("tabAuthActive");
    // Auth tokens are in httpOnly cookies
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