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

    // If already an absolute URL or data URI, return as-is
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

    // Build absolute/relative URL using BASE_URL
    const base = String(BASE_URL).replace(/\/+$/, '');
    const normalized = trimmed.replace(/^\.?\//, '/');
    
    // Live domain par relative path /uploads/... banayega jo vercel.json backend routes par send kar dega
    return `${base}${normalized.startsWith('/') ? normalized : '/' + normalized}`;
}

// Use this only for admin/SEO actions. Public catalogue, blog and contact APIs do not need it.
export function getAuthHeaders(headers = {}) {
    return headers;
}

export const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyyeLQYUdCrT8FxwDNLv-wVGF_YfC4aK4G4g4g2rRnWvtqeJeySVghAUFF1eN_atdnk/exec";

export default BASE_URL;
