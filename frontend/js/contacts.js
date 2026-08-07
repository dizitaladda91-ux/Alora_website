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
// 2. DYNAMIC NAVBAR RENDERING FUNCTION
// ==========================================
export function renderNavbarState() {
    const authActions = document.getElementById("auth-actions");
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!authActions) {
        console.warn("Auth placeholder (#auth-actions) abhi DOM me nahi mila. Wait kar rahe hain...");
        return;
    }

    if (storedUser && token) {
        try {
            const user = JSON.parse(storedUser);
            const displayName = user.name || "User";

            authActions.innerHTML = `
                <div class="flex items-center gap-3 text-sm font-medium text-black normal-case">
                    <span>Hi, <b class="text-[#2A2A24] font-bold uppercase">${displayName}</b></span>
                    <button id="logout-btn" class="bg-black hover:bg-orange-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg transition uppercase tracking-wider font-bold shadow-sm">
                        Logout
                    </button>
                </div>
            `;

            document.getElementById("logout-btn").addEventListener("click", () => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "./index.html";
            });

        } catch (err) {
            console.error("Localstorage data read error:", err);
            localStorage.removeItem("user");
            localStorage.removeItem("token");
        }
    } else {
        authActions.innerHTML = `
            <a href="./login.html" class="text-base text-black hover:text-gold transition">
                <i class="fa-solid fa-user"></i>
            </a>
        `;
    }
}

// ==========================================
// 3. LISTEN TO PARTIALS LOADED
// ==========================================
document.addEventListener("partialsLoaded", () => {
    console.log("Navbar successfully injected! Applying states...");
    renderNavbarState();
});

if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(renderNavbarState, 150);
}

// ==========================================
// 4. CONTACT FORM SUBMISSION (SINGLE INSTANCE WITH DEBOUNCE)
// ==========================================
let isSubmitting = false; 

document.addEventListener("submit", async (e) => {
    if (e.target && e.target.id === "contactForm") {
        e.preventDefault();

        // Agar process already chal raha hai, to click ignore hoga
        if (isSubmitting) return;

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const message = document.getElementById("message").value;

        try {
            isSubmitting = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            console.log("Form submit caught! Sending data:", { name, email, message });

            const response = await fetch(`${BASE_URL}/api/queries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message })
            });

            const data = await response.json();
            console.log("Response:", data);

            if (response.ok) {
                // Success popup custom modal ke sath
                showSuccessModal(
                    "Success!", 
                    "Aapki query successfully save ho gayi hai. Hum aapse jald hi contact karenge.", 
                    () => {
                        form.reset(); 
                    }
                );
            } else {
                alert("Error: " + (data.message || "Something went wrong"));
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            alert("*The server is not connected. Please try again later.**");
        } finally {
            // Sahi timing par state aur button reset karna
            isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "Submit";
            }
        }
    }
});