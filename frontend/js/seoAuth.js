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
    const storedUserStr = sessionStorage.getItem("user");
    let storedUser = null;
    try {
        if (storedUserStr) storedUser = JSON.parse(storedUserStr);
    } catch (e) {}
    const isRoleValid = role === "seoadmin" || role === "admin" || (storedUser && (storedUser.role === "seoadmin" || storedUser.role === "admin"));
    if (!isTabActive || !isRoleValid) {
        clearAllAuthStorageAndRedirect();
        return;
    }
    const freshUser = await getCurrentSession();
    if (freshUser && (freshUser.role === "seoadmin" || freshUser.role === "admin")) {
        sessionStorage.setItem("user", JSON.stringify(freshUser));
        sessionStorage.setItem("userRole", freshUser.role);
    } else {
        clearAllAuthStorageAndRedirect();
        return;
        return;
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