// Lightweight, dependency-free toast notification system. Import this file
// anywhere and call window.showToast(message, type) to replace alert().
const TOAST_STYLES = {
    success: { icon: "fa-circle-check", bg: "bg-emerald-600" },
    error: { icon: "fa-circle-exclamation", bg: "bg-red-600" },
    info: { icon: "fa-circle-info", bg: "bg-gray-800" },
    warning: { icon: "fa-triangle-exclamation", bg: "bg-amber-500" }
};

function ensureToastContainer() {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm";
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = "info", durationMs = 3500) {
    const container = ensureToastContainer();
    const style = TOAST_STYLES[type] || TOAST_STYLES.info;

    const toast = document.createElement("div");
    toast.className = `${style.bg} text-white text-sm font-medium rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 pointer-events-auto opacity-0 translate-x-4 transition-all duration-300`;
    toast.innerHTML = `
        <i class="fa-solid ${style.icon} mt-0.5"></i>
        <span class="flex-1">${String(message)}</span>
        <button type="button" class="text-white/70 hover:text-white leading-none" aria-label="Dismiss">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove("opacity-0", "translate-x-4"));

    const dismiss = () => {
        toast.classList.add("opacity-0", "translate-x-4");
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector("button").addEventListener("click", dismiss);
    if (durationMs > 0) setTimeout(dismiss, durationMs);
}

// Exposed globally so it can replace alert() in non-module scripts and inline
// onclick handlers without needing an import in every file.
window.showToast = showToast;