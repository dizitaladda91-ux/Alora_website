import BASE_URL from "./config.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

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
            <button id="modal-ok-btn" class="w-full bg-[#2A2A24] hover:bg-amber-800 text-white font-semibold py-2.5 rounded-xl transition shadow-md focus:outline-none cursor-pointer">
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

export function showVerificationWaitingModal(userEmail, callback) {
    const existingModal = document.getElementById("custom-success-modal");
    if (existingModal) existingModal.remove();

    let pollTimer = null;

    const cleanup = () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };

    const modal = document.createElement("div");
    modal.id = "custom-success-modal";
    modal.className = "fixed inset-0 flex items-center justify-center z-[9999] bg-black/60 backdrop-blur-sm p-4";
    modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-amber-900/10 text-center relative overflow-hidden">
            <!-- Top Accent Bar -->
            <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-[#8B4513] to-amber-700"></div>

            <!-- Rotating Spinner State -->
            <div id="polling-spinner-container" class="w-16 h-16 mx-auto mb-3 bg-amber-50 text-[#8B4513] rounded-2xl border border-amber-200 flex items-center justify-center text-3xl shadow-inner">
                <i class="fa-solid fa-spinner fa-spin"></i>
            </div>

            <!-- Verified Checkmark State (Hidden initially) -->
            <div id="polling-verified-container" class="hidden w-16 h-16 mx-auto mb-3 bg-emerald-50 text-emerald-600 rounded-2xl border-2 border-emerald-200 flex items-center justify-center text-3xl shadow-inner">
                <i class="fa-solid fa-circle-check"></i>
            </div>

            <span id="polling-badge" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-300 mb-2">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Waiting for Email Verification...
            </span>

            <h3 id="polling-title" class="text-2xl font-bold text-slate-900 font-serif mb-1">Verify Your Email</h3>
            <p id="polling-desc" class="text-stone-600 text-xs sm:text-sm mb-4 leading-relaxed">
                Verification link sent to <strong class="text-slate-900 font-mono select-all">${escapeHtml(userEmail)}</strong>.<br>
                <span class="text-[#8B4513] font-semibold mt-1 block">Click the link in your email to instantly auto-login!</span>
            </p>

            <div id="polling-actions" class="space-y-2 pt-1">
                <button id="modal-resend-btn" type="button" class="w-full bg-[#8B4513] hover:bg-amber-900 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-2">
                    <i class="fa-solid fa-paper-plane"></i> Resend Verification Email
                </button>
                <button id="modal-close-btn" type="button" class="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition border border-stone-200 cursor-pointer">
                    Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Bind Resend button
    const resendBtn = document.getElementById("modal-resend-btn");
    if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
            const orig = resendBtn.innerHTML;
            resendBtn.disabled = true;
            resendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
            try {
                const res = await fetch(`${BASE_URL}/api/auth/resend-verification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: userEmail })
                });
                const resData = await res.json();
                if (res.ok && resData.success) {
                    resendBtn.innerHTML = `<i class="fa-solid fa-check"></i> Email Resent!`;
                    setTimeout(() => {
                        resendBtn.innerHTML = orig;
                        resendBtn.disabled = false;
                    }, 4000);
                } else {
                    resendBtn.innerHTML = orig;
                    resendBtn.disabled = false;
                }
            } catch (e) {
                resendBtn.innerHTML = orig;
                resendBtn.disabled = false;
            }
        });
    }

    // Bind Close button
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            cleanup();
            modal.remove();
        });
    }

    // Real-Time Polling Engine
    const checkStatus = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/auth/poll-verification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email: userEmail })
            });

            const data = await res.json();
            if (res.ok && data.verified === true) {
                cleanup();

                // UI Success Transition
                const spinnerEl = document.getElementById("polling-spinner-container");
                const verifiedEl = document.getElementById("polling-verified-container");
                const badgeEl = document.getElementById("polling-badge");
                const titleEl = document.getElementById("polling-title");
                const descEl = document.getElementById("polling-desc");
                const actionsEl = document.getElementById("polling-actions");

                if (spinnerEl) spinnerEl.classList.add("hidden");
                if (verifiedEl) verifiedEl.classList.remove("hidden");
                if (badgeEl) {
                    badgeEl.className = "inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-2";
                    badgeEl.innerHTML = '<i class="fa-solid fa-circle-check text-blue-600"></i> Verified Blue Tick Active!';
                }
                if (titleEl) titleEl.innerText = "Email Verified!";
                if (descEl) descEl.innerHTML = "<span class='text-emerald-700 font-bold'>Account verified successfully! Logging you in now...</span>";
                if (actionsEl) actionsEl.innerHTML = "";

                // Store user session
                if (data.token) {
                    localStorage.setItem("token", data.token);
                    sessionStorage.setItem("token", data.token);
                }
                const userData = data.user || {};
                const displayName = userData.name || userData.username || (userData.email ? userData.email.split('@')[0] : "User");
                const userObjToStore = {
                    ...userData,
                    name: displayName
                };
                const role = userData.role ? userData.role.toLowerCase().trim() : "user";
                sessionStorage.setItem("tabAuthActive", "true");
                sessionStorage.setItem("userRole", role);
                sessionStorage.setItem("user", JSON.stringify(userObjToStore));
                localStorage.setItem("userRole", role);
                localStorage.setItem("user", JSON.stringify(userObjToStore));

                setTimeout(() => {
                    modal.remove();
                    if (callback) callback();
                    else window.location.href = "./account.html";
                }, 1200);
            }
        } catch (pollErr) {
            console.warn("Poll error:", pollErr);
        }
    };

    // Run first check after 2 seconds, then poll every 2.5 seconds
    pollTimer = setInterval(checkStatus, 2500);
}
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
    // Auth tokens are in httpOnly cookies (cleared by logout endpoint)
    const isLoginPage = currentPath.endsWith("login.html") || 
                        currentPath.endsWith("/login") ||
                        currentPath.endsWith("register.html") || 
                        currentPath.endsWith("/register");
    if (user && isLoginPage) {
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
                      currentPath.includes("seoadminupdate") ||
                      currentPath.includes("seoproduct");
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
// On public customer pages, defer auth session check to idle time to eliminate critical request chain
const isProtectedAdminPage = window.location.pathname.toLowerCase().includes('admin') || window.location.pathname.toLowerCase().includes('seo');
if (isProtectedAdminPage) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", runAuthGuard);
    } else {
        runAuthGuard();
    }
} else {
    window.addEventListener("load", () => {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(runAuthGuard, { timeout: 3000 });
        } else {
            setTimeout(runAuthGuard, 2000);
        }
    });
}
async function handleLogout() {
    try {
        await fetch(`${BASE_URL}/api/auth/logout`, { 
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include" 
        });
    } catch (err) {
        console.error("Logout API error:", err);
    } finally {
        sessionStorage.clear();
        localStorage.removeItem("user");
        localStorage.removeItem("userRole");
        localStorage.removeItem("tabAuthActive");
        // Auth tokens are in httpOnly cookies and cleared by server
        window.location.replace("./login.html");
    }
}
document.addEventListener("click", (e) => {
    const logoutBtn = e.target.closest("#adminLogoutBtn, #logout-btn, #seoLogoutBtn, .seo-logout-btn, .logout-btn-trigger, #sidebar-logout-btn");
    if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleLogout();
    }
});
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
            if (response.ok || data.isUnverified) {
                showVerificationWaitingModal(email, () => {
                    window.location.href = "./account.html";
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
            if (data.isUnverified) {
                showVerificationWaitingModal(email, () => {
                    window.location.href = "./account.html";
                });
                return;
            }
            if (response.ok && data.success !== false) {
                if (data.token) {
                    localStorage.setItem("token", data.token);
                    sessionStorage.setItem("token", data.token);
                }
                const userData = data.user || data.data || {};
                const displayName = userData.name || userData.username || (userData.email ? userData.email.split('@')[0] : "User");
                const userObjToStore = {
                    ...userData,
                    name: displayName
                };
                const role = userData.role ? userData.role.toLowerCase().trim() : "user";
                sessionStorage.setItem("tabAuthActive", "true");
                sessionStorage.setItem("userRole", role);
                sessionStorage.setItem("user", JSON.stringify(userObjToStore));
                localStorage.setItem("userRole", role);
                localStorage.setItem("user", JSON.stringify(userObjToStore));
                let targetUrl = "./account.html"; 
                if (role === "admin") {
                    targetUrl = "./admin.html";
                } else if (role === "seoadmin") {
                    targetUrl = "./seoadmin.html";
                } else if (role === "affiliate") {
                    targetUrl = "./affiliate.html";
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
function initForgotForm() {
    const forgotForm = document.getElementById("forgotForm");
    if (!forgotForm) return;
    const newForgotForm = forgotForm.cloneNode(true);
    forgotForm.parentNode.replaceChild(newForgotForm, forgotForm);
    newForgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const forgotEmailEl = document.getElementById("forgotEmail") || document.getElementById("email");
        const deliveryEmailEl = document.getElementById("deliveryEmail");

        if (!forgotEmailEl) return;
        const email = forgotEmailEl.value.trim();
        const deliveryEmail = deliveryEmailEl ? deliveryEmailEl.value.trim() : "";

        if (!email) {
            showSuccessModal("Warning", "Kripya Account Email enter karein!", null);
            return;
        }
        try {
            const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, deliveryEmail }),
                credentials: "include"
            });
            const data = await response.json();
            if (response.ok) {
                showSuccessModal("Reset Link Sent", data.message || "Reset link bhej diya gaya hai!", () => {
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
export function renderNavbarState() {
    const storedUserStr = localStorage.getItem("user") || sessionStorage.getItem("user");
    const updateUI = (authContainer) => {
        if (!storedUserStr) {
            authContainer.innerHTML = `
                <a href="./login.html" aria-label="User Account Login" title="User Account Login" class="text-base text-black hover:text-gold transition">
                    <i class="fa-solid fa-user" aria-hidden="true"></i>
                    <span class="sr-only">User Account Login</span>
                </a>
            `;
            return;
        }
        try {
            const user = JSON.parse(storedUserStr);
            const role = user.role || sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
            if (role === "admin" || role === "seoadmin") {
                authContainer.innerHTML = `
                    <a href="${role === 'admin' ? './admin.html' : './seoadmin.html'}" aria-label="Admin Portal" title="Admin Portal" class="text-base text-black hover:text-gold transition">
                        <i class="fa-solid fa-user" aria-hidden="true"></i>
                        <span class="sr-only">Admin Portal</span>
                    </a>
                `;
            } else {
                const userName = user.name || user.username || (user.email ? user.email.split('@')[0] : "User");
                authContainer.innerHTML = `
                    <!-- Desktop View: Full Controls -->
                    <div class="hidden md:flex items-center gap-2.5 text-sm font-medium text-black normal-case">
                        <a href="./account.html" class="hover:text-[#A0522D] transition flex items-center gap-1">
                            <span class="whitespace-nowrap">Hi, <b class="text-[#2A2A24] font-bold uppercase">${userName}</b></span>
                        </a>
                        <a href="./account.html" class="bg-amber-100 hover:bg-amber-200 text-[#8B4513] text-[11px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-extrabold shadow-xs flex items-center gap-1.5 border border-amber-300">
                            <i class="fa-solid fa-user-circle text-xs"></i> My Account
                        </a>
                        <button type="button" class="logout-btn-trigger bg-black hover:bg-orange-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-bold shadow-sm cursor-pointer">
                            Logout
                        </button>
                    </div>
                    <!-- Mobile View: Compact Sleek User Profile Icon -->
                    <div class="flex md:hidden items-center">
                        <a href="./account.html" class="relative text-[#152219] hover:text-[#8B4513] transition p-1.5 flex items-center justify-center rounded-full bg-amber-50 border border-amber-200/80 shadow-2xs" title="My Account (${userName})">
                            <i class="fa-solid fa-user text-sm text-[#8B4513]"></i>
                            <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
                        </a>
                    </div>
                `;
                // Also update Mobile Drawer Auth Section if present
                const mobileDrawerAuth = document.querySelector('#mobile-menu-drawer .pt-6.border-t');
                if (mobileDrawerAuth) {
                    mobileDrawerAuth.innerHTML = `
                        <div class="p-3 bg-amber-50/90 rounded-2xl border border-amber-200/80 shadow-2xs mb-1">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-8 h-8 rounded-full bg-[#8B4513] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                    ${userName.charAt(0)}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-slate-900 truncate">Hi, ${userName}</p>
                                    <p class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Logged In
                                    </p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-2">
                                <a href="./account.html" class="bg-amber-100 hover:bg-amber-200 text-[#8B4513] text-[11px] py-1.5 px-2 rounded-lg text-center font-bold flex items-center justify-center gap-1 border border-amber-300">
                                    <i class="fa-solid fa-user-circle text-[10px]"></i> My Account
                                </a>
                                <button type="button" class="logout-btn-trigger bg-slate-900 text-white text-[11px] py-1.5 px-2 rounded-lg text-center font-bold cursor-pointer">
                                    Logout
                                </button>
                            </div>
                        </div>
                    `;
                }
                document.querySelectorAll('.logout-btn-trigger').forEach((btn) => {
                    if (!btn.dataset.bound) {
                        btn.dataset.bound = "true";
                        btn.addEventListener("click", (e) => {
                            e.preventDefault();
                            handleLogout();
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Error parsing user from storage:", err);
            localStorage.removeItem("user");
        }
    };
    const checkAndRender = () => {
        let authActions = document.getElementById("auth-actions");
        if (!authActions) {
            const navAuthContainer = document.getElementById("nav-auth-container");
            if (navAuthContainer) {
                authActions = navAuthContainer.querySelector('#auth-actions');
                if (!authActions) {
                    authActions = document.createElement('div');
                    authActions.id = 'auth-actions';
                    authActions.className = 'flex items-center gap-4';
                    navAuthContainer.appendChild(authActions);
                }
            }
        }
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