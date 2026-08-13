import BASE_URL from "./config.js";

async function getCurrentSession() {
    const response = await fetch(`${BASE_URL}/api/auth/session`, { credentials: "include" });
    if (!response.ok) return null;

    const data = await response.json();
    return data.success ? data.user : null;
}

async function protectAdminPage() {
    const user = await getCurrentSession();
    if (!user || user.role !== "admin") {
        localStorage.removeItem("user");
        window.location.replace("./login.html");
        return;
    }

    // Non-sensitive display data only; authentication remains cookie/server based.
    localStorage.setItem("user", JSON.stringify(user));
    const welcomeText = document.querySelector("main h2");
    if (welcomeText && user.name) {
        welcomeText.innerHTML = `Hello ${user.name.toUpperCase()}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    protectAdminPage();

    document.getElementById("adminLogoutBtn")?.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
            await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
        } finally {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            localStorage.removeItem("userToken");
            window.location.href = "./login.html";
        }
    });
});
