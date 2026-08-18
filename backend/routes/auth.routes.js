import express from "express";
import { register, login, logout, forgotPassword, resetPassword, getSession, updateProfile } from '../controllers/auth.controllers.js';
import jwt from "jsonwebtoken";
import { requireAuth } from "../middlewares/auth.middleware.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ==========================================
// MIDDLEWARES FOR WEB & API PROTECTION
// ==========================================

// Safe Protect Middleware (Optional Chaining added to avoid undefined error crashes)
const protectView = (req, res, next) => {
  const token = req.cookies?.token;

  // Agar token nahi mila, toh directly login page par redirect kar do
  if (!token) {
    return res.redirect("/login.html");
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Refusing to serve a protected view.");
    return res.status(500).send("Server authentication is not configured.");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id, role }
    next();
  } catch (error) {
    res.clearCookie("token");
    return res.redirect("/login.html");
  }
};

// Role Authentication Middleware for Views
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // Agar role match nahi karta, toh homepage par bhej do
      return res.redirect("/index.html"); 
    }
    next();
  };
};

// ==========================================
// PUBLIC API ROUTES
// ==========================================
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', logout);
router.get('/api/auth/session', requireAuth, getSession);
router.put('/api/auth/profile', requireAuth, updateProfile);

// Forgot Password & Reset Password API Routes
router.post('/api/auth/forgot-password', forgotPassword);
router.post('/api/auth/reset-password', resetPassword);

// ==========================================
// PUBLIC PAGES SERVING
// ==========================================
router.get('/reset-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/reset-password.html'));
});

// ==========================================
// PROTECTED PAGES SERVING (Direct URL Protection)
// ==========================================

// 1. ADMIN PAGES LIST & PROTECTION LOOP
const adminPages = [
  'admin.html',
  'addnewproduct.html',
  'adminleadshow.html',
  'adminproduct.html',
  'adminupdateproduct.html',
  'adminUserquery.html'
];

const registerProtectedViews = (pages, roles) => {
  pages.forEach((page) => {
    const cleanPageName = page.replace(/\.html$/, '');
    const sendProtectedPage = (req, res) => {
    res.sendFile(path.join(__dirname, `../../frontend/${page}`)); 
    };

    router.get(`/${page}`, protectView, authorizeRoles(...roles), sendProtectedPage);
    router.get(`/${cleanPageName}`, protectView, authorizeRoles(...roles), sendProtectedPage);
  });
};

registerProtectedViews(adminPages, ['admin']);

// 2. SEO ADMIN PAGES LIST & PROTECTION LOOP
const seoPages = [
  'seoadmin.html',
  'seoadminupdate.html',
  'seoallpost.html',
  'seoproduct.html',
  'seoproductupdate.html'
];

registerProtectedViews(seoPages, ['seoadmin', 'admin']);

registerProtectedViews(['affiliate.html'], ['affiliate']);

export default router;
