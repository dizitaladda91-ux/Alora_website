// Security Middleware for Antigravity Enterprise Protection

const requestLogs = new Map();

// Cleanup stale IP logs every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, log] of requestLogs.entries()) {
        if (now > log.resetTime) {
            requestLogs.delete(ip);
        }
    }
}, 10 * 60 * 1000);

// 1. Security Headers Middleware (Clickjacking, XSS, MIME Sniffing Protection)
export const setSecurityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
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

// 3. Dynamic Rate Limiter Middleware (Anti-DDoS, Anti-BruteForce)
export const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests. Please try again later." } = {}) => {
    return (req, res, next) => {
        const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
        const now = Date.now();

        let log = requestLogs.get(clientIp);

        if (!log || now > log.resetTime) {
            log = { count: 1, resetTime: now + windowMs };
            requestLogs.set(clientIp, log);
            return next();
        }

        log.count++;

        if (log.count > max) {
            return res.status(429).json({
                success: false,
                message: message,
                retryAfterSeconds: Math.ceil((log.resetTime - now) / 1000)
            });
        }

        next();
    };
};
