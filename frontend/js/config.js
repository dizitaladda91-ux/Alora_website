// Backend URL configuration
const DEFAULT_LOCAL_BACKEND_PORT = 5000;

function computeBaseUrl() {
    const { protocol, hostname } = window.location;

    // 1. When opened as file:// treat as local frontend and point to localhost backend
    if (protocol === 'file:') {
        return `http://localhost:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }

    // 2. Common local development hosts
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }

    // 3. Vercel & Production Hostinger Domain:
    // Live par empty string "" rahega taaki relative paths (/api/...) same domain par point karein
// Backend URL configuration
const DEFAULT_LOCAL_BACKEND_PORT = 5000;

function computeBaseUrl() {
    const { protocol, hostname } = window.location;

    // 1. When opened as file:// treat as local frontend and point to localhost backend
    if (protocol === 'file:') {
        return `http://localhost:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }

    // 2. Common local development hosts
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:${DEFAULT_LOCAL_BACKEND_PORT}`;
    }

    // 3. Vercel & Production Hostinger Domain:
    // Live par empty string "" rahega taaki relative paths (/api/...) same domain par point karein
    return "";
}

const BASE_URL = computeBaseUrl();

export function getImageUrl(imagePath, fallback = "./static/placeholder.png") {
    if (!imagePath || typeof imagePath !== 'string') return fallback;

    const trimmed = imagePath.trim();
    if (!trimmed) return fallback;

    // Cloudinary dynamic URL optimization (w_500, c_limit, q_auto, f_auto)
    if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/upload/') && !trimmed.includes('/w_')) {
        return trimmed.replace('/upload/', '/upload/w_500,c_limit,q_auto,f_auto/');
    }

    // If already an absolute URL or data URI, return as-is
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

    // Build absolute/relative URL using BASE_URL
    const base = String(BASE_URL).replace(/\/+$/, '');
    const normalized = trimmed.replace(/^\.?\//, '/');
    
    // Live domain par relative path /uploads/... banayega jo vercel.json backend routes par send kar dega
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

// Use this only for admin/SEO actions. Public catalogue, blog and contact APIs do not need it.
export function getAuthHeaders(headers = {}) {
    return headers;
}

export async function safeFetchJson(url, options = {}) {
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

    return data;
}

export const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyyeLQYUdCrT8FxwDNLv-wVGF_YfC4aK4G4g4g2rRnWvtqeJeySVghAUFF1eN_atdnk/exec";

export default BASE_URL;
