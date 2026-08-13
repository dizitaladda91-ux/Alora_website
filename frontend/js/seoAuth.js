import BASE_URL from "./config.js";

async function protectSeoPage() {
    const response = await fetch(`${BASE_URL}/api/auth/session`, { credentials: "include" });
    if (!response.ok) {
        localStorage.removeItem("user");
        window.location.replace("./login.html");
        return;
    }

    const data = await response.json();
    const user = data.user;
    if (!data.success || !user || !["admin", "seoadmin"].includes(user.role)) {
        localStorage.removeItem("user");
        window.location.replace("./login.html");
        return;
    }

    localStorage.setItem("user", JSON.stringify(user));
    const welcomeText = document.querySelector("main h2");
    if (welcomeText && user.name) welcomeText.innerHTML = `Hello ${user.name.toUpperCase()}`;
}

document.addEventListener("DOMContentLoaded", () => {
    protectSeoPage();

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
