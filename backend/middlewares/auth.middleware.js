import jwt from "jsonwebtoken";
import User from "../models/userAuth.models.js";

const jwtOptions = { issuer: "alora-radiance", audience: "alora-web" };

const getTokenFromRequest = (req) => {
  const authorization = req.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return req.cookies?.token || "";
};

export const verifyAuthToken = (token) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is missing");
  return jwt.verify(token, process.env.JWT_SECRET, jwtOptions);
};

export const requireAuth = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Refusing to authenticate a protected request.");
    return res.status(500).json({ success: false, message: "Server authentication is not configured." });
  }

  try {
    const claims = verifyAuthToken(token);
    const user = await User.findById(claims.id).select("role").lean();
    if (!user || user.role !== claims.role) {
      return res.status(401).json({ success: false, message: "Session is no longer valid." });
    }
    req.user = { ...claims, role: user.role };
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
    req.user = verifyAuthToken(token);
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
