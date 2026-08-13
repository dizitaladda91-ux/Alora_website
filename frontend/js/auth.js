import BASE_URL from "./config.js";

// ==========================================
// 1. GLOBAL CUSTOM SUCCESS MODAL
// ==========================================
export function showSuccessModal(title, message, callback) {
    const existingModal = document.getElementById("custom-success-modal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "custom-success-modal";
    modal.className = "fixed inset-0 flex items-center justify-center z-[9999] bg-black/60 backdrop-blur-sm";
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-gold/20 text-center">
            <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">${title}</h3>
            <p class="text-gray-500 text-sm mb-6">${message}</p>
            <button id="modal-ok-btn" class="w-full bg-[#2A2A24] hover:bg-amber-800 text-white font-semibold py-2.5 rounded-xl transition shadow-md focus:outline-none">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("modal-ok-btn").addEventListener("click", () => {
        modal.remove();
        if (callback) callback();
    });
}

// ==========================================
// 2. ROUTE & GUARD LOGIC
// ==========================================
async function runAuthGuard() {
    const currentPath = window.location.pathname.toLowerCase();
    let user = null;
    let role = "";

    try {
        const response = await fetch(`${BASE_URL}/api/auth/session`, { credentials: "include" });
        if (response.ok) {
            const data = await response.json();
            user = data.user || null;
            role = user?.role ? String(user.role).toLowerCase().trim() : "";
            if (user) localStorage.setItem("user", JSON.stringify(user));
        } else {
            localStorage.removeItem("user");
        }
    } catch (error) {
        console.warn("Could not check server session:", error);
    }

    // Clear legacy browser tokens from older versions. The JWT now remains HttpOnly.
    localStorage.removeItem("token");
    localStorage.removeItem("userToken");

    const isPublicPage = currentPath.endsWith("login.html") || 
                         currentPath.endsWith("register.html") || 
                         currentPath.endsWith("index.html") || 
                         currentPath === "/" || 
                         currentPath.endsWith("/");

    if (user && isPublicPage && !currentPath.endsWith("index.html")) {
        if (role.includes("seo")) {
            window.location.replace("./seoadmin.html");
            return;
        } else if (role.includes("admin")) {
            window.location.replace("./admin.html");
            return;
        }
    }

    const isSeoPage = currentPath.includes("seoadmin") || 
                      currentPath.includes("seoallpost") || 
                      currentPath.includes("seoadminupdate");

    if (isSeoPage) {
        const isSeoUser = role.includes("seo") || role.includes("admin");

        if (!user || !isSeoUser) {
            console.warn("Unauthorized access to SEO page. Redirecting...");
            localStorage.removeItem("user");
            window.location.replace("./login.html");
            return;
        }

        const welcomeText = document.querySelector("main h2");
        if (welcomeText && user.name) {
            const currentText = welcomeText.innerText.toLowerCase();
            if (currentText.includes("hello") || currentText.includes("welcome")) {
                welcomeText.innerHTML = `Hello ${user.name.toUpperCase()}`;
            }
        }
    }

    const adminPagesList = [
        "admin.html",
        "addnewproduct.html",
        "adminleadshow.html",
        "adminproduct.html",
        "adminupdateproduct.html",
        "adminuserquery.html"
    ];

    const isAdminPage = adminPagesList.some(page => currentPath.includes(page));

    if (isAdminPage) {
        if (!user || !role.includes("admin")) {
            console.warn("Unauthorized access to Admin page. Redirecting...");
            localStorage.removeItem("user");
            window.location.replace("./login.html");
            return;
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAuthGuard);
} else {
    runAuthGuard();
}

// ==========================================
// 3. LOGOUT LOGIC
// ==========================================
async function handleLogout() {
    try {
        await fetch(`${BASE_URL}/api/auth/logout`, { 
            method: "POST",
            credentials: "include" 
        });
    } catch (err) {
        console.error("Logout API error:", err);
    }
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("userToken");
    window.location.replace("./login.html");
}

document.addEventListener("click", (e) => {
    if (e.target && (
        e.target.id === "adminLogoutBtn" || 
        e.target.closest("#adminLogoutBtn") || 
        e.target.id === "logout-btn" || 
        e.target.closest("#logout-btn")
    )) {
        e.preventDefault();
        handleLogout();
    }
});

// ==========================================
// 4. FORM HANDLERS (REGISTER, LOGIN, FORGOT)
// ==========================================

// 4.1 NORMAL USER REGISTER FORM HANDLER
function initRegisterForm() {
    const registerForm = document.getElementById("registerForm") || document.getElementById("signupForm");
    if (!registerForm) return;

    const newForm = registerForm.cloneNode(true);
    registerForm.parentNode.replaceChild(newForm, registerForm);

    newForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nameEl = document.getElementById("fullName") || document.getElementById("name") || document.getElementById("regName");
        const emailEl = document.getElementById("regEmail") || document.getElementById("email");
        const passwordEl = document.getElementById("regPassword") || document.getElementById("password");
        const phoneEl = document.getElementById("phone") || document.getElementById("phoneNumber") || document.getElementById("regPhone");

        if (!nameEl || !emailEl || !passwordEl || !phoneEl) {
            showSuccessModal("Error", "Registration inputs ID missing. Check HTML input IDs!", null);
            return;
        }

        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const password = passwordEl.value;
        const phone = phoneEl.value.trim();

        try {
            const response = await fetch(`${BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, phone }),
                credentials: "include"
            });

            const data = await response.json();

            if (response.ok) {
                showSuccessModal("Registration Successful!", data.message || "Account successful created!", () => {
                    window.location.href = "./login.html";
                });
            } else {
                showSuccessModal("Registration Failed", data.message || "Could not complete registration.", null);
            }
        } catch (error) {
            console.error("Register Error:", error);
            showSuccessModal("Error", "Server se contact nahi ho pa raha hai.", null);
        }
    });
}

// 4.2 LOGIN FORM HANDLER
function initLoginForm() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);

    newForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const emailEl = document.getElementById("email");
        const passwordEl = document.getElementById("password");
        if (!emailEl || !passwordEl) return;

        const email = emailEl.value.trim();
        const password = passwordEl.value;

        try {
            const response = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
                credentials: "include" 
            });

            const data = await response.json();

            if (response.ok && data.success !== false) {
                const userData = data.user || data.data || {};
                const displayName = userData.name || userData.username || (userData.email ? userData.email.split('@')[0] : "User");
                
                const userObjToStore = {
                    ...userData,
                    name: displayName
                };

                localStorage.setItem("user", JSON.stringify(userObjToStore)); 
                // JWT stays in the HttpOnly cookie and must never be stored in localStorage.
                localStorage.removeItem("token");
                localStorage.removeItem("userToken");

                const role = userData.role ? userData.role.toLowerCase().trim() : "user";
                
                let targetUrl = "./index.html"; 
                if (role === "admin") {
                    targetUrl = "./admin.html";
                } else if (role === "seoadmin") {
                    targetUrl = "./seoadmin.html";
                }

                showSuccessModal("Login Successful!", `Welcome back, ${displayName}!`, () => {
                    window.location.href = targetUrl;
                });
            } else {
                showSuccessModal("Login Failed", data.message || "Invalid Email or Password.", null);
            }
        } catch (error) {
            console.error("Login Error:", error);
            showSuccessModal("Error", "Server se contact nahi ho paa raha hai.", null);
        }
    });
}

// 4.3 FORGOT PASSWORD FORM HANDLER
function initForgotForm() {
    const forgotForm = document.getElementById("forgotForm");
    if (!forgotForm) return;

    const newForgotForm = forgotForm.cloneNode(true);
    forgotForm.parentNode.replaceChild(newForgotForm, forgotForm);

    newForgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const forgotEmailEl = document.getElementById("forgotEmail");
        if (!forgotEmailEl) return;

        const email = forgotEmailEl.value.trim();
        if (!email) {
            showSuccessModal("Warning", "Kripya email enter karein!", null);
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
                credentials: "include"
            });

            const data = await response.json();

            if (response.ok) {
                showSuccessModal("Reset Link Sent", data.message || "Reset link aapki email par bhej diya gaya hai!", () => {
                    const loginSection = document.getElementById('loginSection');
                    const forgotSection = document.getElementById('forgotSection');
                    if(loginSection && forgotSection) {
                        forgotSection.classList.add('hidden');
                        loginSection.classList.remove('hidden');
                    }
                });
            } else {
                showSuccessModal("Failed", data.message || "Email bhejne me issue aaya.", null);
            }
        } catch (error) {
            console.error("Forgot Password Error:", error);
            showSuccessModal("Error", "Server se connect nahi ho paa raha hai.", null);
        }
    });
}

function initAuthForms() {
    initRegisterForm();
    initLoginForm();
    initForgotForm();
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    initAuthForms();
} else {
    document.addEventListener("DOMContentLoaded", initAuthForms);
}

// ==========================================
// 5. NAVBAR STATE RENDERING
// ==========================================
export function renderNavbarState() {
    const storedUser = localStorage.getItem("user");

    const updateUI = (authContainer) => {
        if (!storedUser) {
            authContainer.innerHTML = `
                <a href="./login.html" class="text-base text-black hover:text-gold transition">
                    <i class="fa-solid fa-user"></i>
                </a>
            `;
            return;
        }

        try {
            const user = JSON.parse(storedUser);
            const userName = user.name || user.username || (user.email ? user.email.split('@')[0] : "User");

            authContainer.innerHTML = `
                <div class="flex items-center gap-3 text-sm font-medium text-black normal-case">
                    <span class="whitespace-nowrap">Hi, <b class="text-[#2A2A24] font-bold uppercase">${userName}</b></span>
                    ${user.role === 'user' ? '<a href="./myorders.html" class="text-[10px] font-bold uppercase text-[#A0522D] hover:underline">My Orders</a>' : ''}
                    <button id="logout-btn" class="bg-black hover:bg-orange-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-bold shadow-sm cursor-pointer">
                        Logout
                    </button>
                </div>
            `;
        } catch (err) {
            console.error("Error parsing user from localStorage:", err);
            localStorage.removeItem("user");
        }
    };

    const checkAndRender = () => {
        const authActions = document.getElementById("auth-actions");
        if (authActions) {
            updateUI(authActions);
            return true;
        }
        return false;
    };

    if (checkAndRender()) return;

    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (checkAndRender() || attempts > 30) {
            clearInterval(interval);
        }
    }, 100);
}

document.addEventListener("partialsLoaded", renderNavbarState);
document.addEventListener("DOMContentLoaded", renderNavbarState);
window.addEventListener("load", renderNavbarState);
renderNavbarState();
