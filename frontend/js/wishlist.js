import BASE_URL, { getAuthHeaders } from "./config.js";

const LOCAL_WISHLIST_KEY = "alora_wishlist_local";

export function getLocalWishlist() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_WISHLIST_KEY) || "[]");
    } catch {
        return [];
    }
}

export function saveLocalWishlist(list) {
    try {
        localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn("Could not persist local wishlist", e);
    }
}

export function updateWishlistBadge(count) {
    const badges = document.querySelectorAll("#global-wishlist-badge, #mobile-wishlist-count, #sidebar-wishlist-badge, .wishlist-badge");
    badges.forEach(badge => {
        if (badge) {
            badge.innerText = count || "0";
            if (count > 0) {
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        }
    });
}

export async function fetchUserWishlist() {
    const isLogged = Boolean(localStorage.getItem("user") || sessionStorage.getItem("user"));
    if (!isLogged) {
        const local = getLocalWishlist();
        updateWishlistBadge(local.length);
        return local;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/wishlist`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });
        if (res.ok) {
            const data = await res.json();
            const list = data.data || [];
            updateWishlistBadge(list.length);
            return list;
        }
    } catch (err) {
        console.warn("Could not fetch remote wishlist:", err);
    }

    const local = getLocalWishlist();
    updateWishlistBadge(local.length);
    return local;
}

export async function toggleProductWishlist(productId, btnEl = null) {
    if (!productId) return;
    const isLogged = Boolean(localStorage.getItem("user") || sessionStorage.getItem("user"));

    if (isLogged) {
        try {
            const res = await fetch(`${BASE_URL}/api/wishlist/toggle`, {
                method: "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({ productId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                updateWishlistBadge(data.wishlistCount);
                if (btnEl) {
                    updateHeartUI(btnEl, data.isAdded);
                }
                if (typeof window.showToastNotification === "function") {
                    window.showToastNotification(data.message, data.isAdded ? "success" : "info");
                }
                return data.isAdded;
            }
        } catch (err) {
            console.warn("Wishlist toggle API error:", err);
        }
    }

    // Guest / LocalStorage fallback
    let local = getLocalWishlist();
    const stringId = String(productId);
    const idx = local.findIndex(item => (typeof item === "string" ? item === stringId : String(item._id || item.id) === stringId));
    let isAdded = false;

    if (idx > -1) {
        local.splice(idx, 1);
        isAdded = false;
    } else {
        local.push(productId);
        isAdded = true;
    }

    saveLocalWishlist(local);
    updateWishlistBadge(local.length);
    if (btnEl) {
        updateHeartUI(btnEl, isAdded);
    }
    return isAdded;
}

function updateHeartUI(btnEl, isAdded) {
    const icon = btnEl.querySelector("i") || btnEl;
    if (isAdded) {
        icon.classList.remove("fa-regular", "text-stone-400", "text-slate-400");
        icon.classList.add("fa-solid", "text-rose-600");
    } else {
        icon.classList.remove("fa-solid", "text-rose-600");
        icon.classList.add("fa-regular", "text-stone-400");
    }
}

window.toggleProductWishlist = toggleProductWishlist;

document.addEventListener("DOMContentLoaded", () => {
    fetchUserWishlist();
});
