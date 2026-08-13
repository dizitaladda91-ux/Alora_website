import jwt from "jsonwebtoken";

const getTokenFromRequest = (req) => {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return req.cookies?.token || "";
};

export const requireAuth = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Refusing to authenticate a protected request.");
    return res.status(500).json({ success: false, message: "Server authentication is not configured." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
};

// Attaches a user when a valid cookie/token exists, but keeps guest checkout available.
export const optionalAuth = (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (!token || !process.env.JWT_SECRET) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // A guest checkout must not fail because an old/expired browser cookie exists.
  }

  return next();
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission for this action." });
  }

  return next();
};
