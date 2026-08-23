// Security Middleware for Antigravity Enterprise Protection

// 1. Security Headers Middleware (Clickjacking, XSS, MIME Sniffing Protection)
export const setSecurityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
};

// 2. Anti-NoSQL Query Injection Middleware (Express 5 Compatible)
export const sanitizeNoSql = (req, res, next) => {
    const sanitizeInPlace = (obj) => {
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
            if (key.startsWith("$") || key.includes(".")) {
                const cleanKey = key.replace(/^\$|\./g, "");
                obj[cleanKey] = obj[key];
                delete obj[key];
            }
            if (typeof obj[key] === "object" && obj[key] !== null) {
                sanitizeInPlace(obj[key]);
            }
        }
    };

    try {
        if (req.body) sanitizeInPlace(req.body);
        if (req.query) sanitizeInPlace(req.query);
        if (req.params) sanitizeInPlace(req.params);
    } catch (e) {
        console.warn("Sanitization warning:", e);
    }

    next();
};

// 3. Dynamic Rate Limiter Middleware (Anti-DDoS, Anti-BruteForce - Generous Limits)
export const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 500, message = "Too many requests. Please try again later." } = {}) => {
    const requestLogs = new Map();
    return (req, res, next) => {
        // Skip rate limiting on local development (localhost / 127.0.0.1)
        const clientIp = req.ip || req.socket.remoteAddress || "unknown_ip";
        if (clientIp.includes("127.0.0.1") || clientIp.includes("::1") || clientIp.includes("localhost")) {
            return next();
        }

        const now = Date.now();
        let log = requestLogs.get(clientIp);

        if (!log || now > log.resetTime) {
            log = { count: 1, resetTime: now + windowMs };
            requestLogs.set(clientIp, log);
            return next();
        }

        log.count++;

        if (log.count > max) {
            res.setHeader("Retry-After", Math.ceil((log.resetTime - now) / 1000));
            return res.status(429).json({
                success: false,
                message: message,
                retryAfterSeconds: Math.ceil((log.resetTime - now) / 1000)
            });
        }

        next();
    };
};
