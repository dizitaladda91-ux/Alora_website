const DEFAULT_LOCAL_BACKEND_PORT = 5000;
function computeBaseUrl() {
    const { protocol, hostname } = window.location;
    if (protocol === 'file:') {
        return `http://localhost:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }
    return "";
}
const BASE_URL = computeBaseUrl();
export function getImageUrl(imagePath, fallback = "./static/placeholder.png") {
    if (!imagePath || typeof imagePath !== 'string') return fallback;
    const trimmed = imagePath.trim();
    if (!trimmed) return fallback;
    if (trimmed.includes('res.cloudinary.com')) {
        if (trimmed.includes('/upload/') && !trimmed.includes('f_auto') && !trimmed.includes('q_auto')) {
            return trimmed.replace('/upload/', '/upload/f_auto,q_auto,w_800,c_limit/');
        }
        return trimmed;
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

    const base = String(BASE_URL).replace(/\/+$/, '');
    const normalized = trimmed.replace(/^\.?\//, '/');
    return `${base}${normalized.startsWith('/') ? normalized : '/' + normalized}`;
}
export function getProductUrl(product) {
    const slug = String(product?.slug || product?.name || "product")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `/product/${encodeURIComponent(slug || "product")}`;
}
export function getAuthHeaders(headers = {}) {
    const token = sessionStorage.getItem('userToken') 
        || sessionStorage.getItem('token') 
        || localStorage.getItem('userToken') 
        || localStorage.getItem('token') 
        || localStorage.getItem('jwt');
    const authHeaders = { ...headers };
    if (token && String(token).trim()) {
        authHeaders['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    return authHeaders;
}
export async function safeFetchJson(url, options = {}) {
    const isGetMethod = !options.method || options.method.toUpperCase() === 'GET';
    const cacheKey = isGetMethod ? `alora_fast_cache_${url}` : null;
    if (cacheKey && typeof sessionStorage !== 'undefined') {
        try {
            const cachedItem = sessionStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, data } = JSON.parse(cachedItem);
                const isFresh = (Date.now() - timestamp) < (5 * 60 * 1000);
                if (isFresh && data) {
                    fetch(url, options).then(res => res.ok ? res.json() : null).then(freshData => {
                        if (freshData) {
                            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: freshData }));
                        }
                    }).catch(() => {});
                    return data;
                }
            }
        } catch (e) {}
    }
    let response;
    try {
        response = await fetch(url, options);
    } catch {
        throw new Error(`Network request failed for ${url}. Check the API deployment, CORS, and internet connection.`);
    }
    const contentType = response.headers.get("content-type") || "";
    let data = null;
    let rawText = "";
    try {
        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            rawText = await response.text();
        }
    } catch {
        rawText = "The API returned an unreadable response.";
    }
    if (!response.ok) {
        const errorMessage = data?.error || data?.message || rawText.trim() || `API request failed (${response.status})`;
        throw new Error(errorMessage);
    }
    if (data === null) {
        throw new Error(rawText.trim() || "Server returned an empty JSON response.");
    }
    if (cacheKey && data && typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {}
    }
    return data;
}
export const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyyeLQYUdCrT8FxwDNLv-wVGF_YfC4aK4G4g4g2rRnWvtqeJeySVghAUFF1eN_atdnk/exec";
if (typeof window !== 'undefined') {
    window.BASE_URL = BASE_URL;
    window.getImageUrl = getImageUrl;
    window.getProductUrl = getProductUrl;
    window.getAuthHeaders = getAuthHeaders;
    window.safeFetchJson = safeFetchJson;
}
export default BASE_URL;