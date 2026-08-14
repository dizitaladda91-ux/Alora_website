import User from "../models/userAuth.models.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  sameSite: "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000
};

// JWT Token Generator
const generateToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// Transporter Function (Dynamic Check)
const getTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// ==========================================
// REGISTER USER
// ==========================================
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body; 

    // 1. Mandatory Input Validation (Avoids undefined crashes)
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ 
        message: 'All fields (Name, Email, Password, Phone) are required!' 
      });
    }

    // 2. Existing User Check
    let userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    let phoneExists = await User.findOne({ phone: phone.trim() });
    if (phoneExists) {
      return res.status(400).json({ message: 'Phone number already registered.' });
    }

    // 3. Safe UpperCase Conversion & Creation
    const formattedName = String(name).trim().toUpperCase();

    const user = await User.create({ 
      name: formattedName, 
      email: email.toLowerCase().trim(), 
      password, 
      phone: phone.trim(),
      role: "user" 
    });

    res.status(201).json({ 
      success: true,
      message: 'Registration successful!' 
    });
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==========================================
// LOGIN USER
// ==========================================
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    let userData = null;
    let userRole = "user";
    let userId = "";

    const cleanEmail = email.toLowerCase().trim();

    if (process.env.ADMIN_EMAIL && cleanEmail === process.env.ADMIN_EMAIL.toLowerCase() && password === process.env.ADMIN_PASSWORD) {
      userId = "env-admin-id";
      userRole = "admin";
      userData = { name: "SYSTEM ADMIN", email: process.env.ADMIN_EMAIL, phone: "N/A", role: "admin" };
    }
    else if (process.env.SEO_EMAIL && cleanEmail === process.env.SEO_EMAIL.toLowerCase() && password === process.env.SEO_PASSWORD) {
      userId = "env-seoadmin-id";
      userRole = "seoadmin";
      userData = { name: "SEO ADMIN", email: process.env.SEO_EMAIL, phone: "N/A", role: "seoadmin" };
    }
    else {
      const user = await User.findOne({ email: cleanEmail });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      userId = user._id;
      userRole = user.role;
      userData = { name: user.name, email: user.email, phone: user.phone, role: user.role };
    }

    const token = generateToken(userId, userRole);

    res.cookie("token", token, authCookieOptions);
    
    res.status(200).json({ 
      success: true,
      message: 'Login successful!', 
      user: userData 
    });
  } catch (error) {
    console.error("LOGIN_ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==========================================
// LOGOUT USER
// ==========================================
export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: authCookieOptions.secure,
    sameSite: authCookieOptions.sameSite,
    path: authCookieOptions.path
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// Returns the currently authenticated user without exposing the JWT to browser JavaScript.
export const getSession = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (id === "env-admin-id" || id === "env-seoadmin-id") {
      return res.status(200).json({
        success: true,
        user: {
          name: role === "admin" ? "SYSTEM ADMIN" : "SEO ADMIN",
          role,
          email: role === "admin" ? process.env.ADMIN_EMAIL : process.env.SEO_EMAIL
        }
      });
    }

    const user = await User.findById(id).select("name email phone role").lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Session user no longer exists." });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load session." });
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email enter karein!" });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ message: ".env file me EMAIL_USER ya EMAIL_PASS missing hai!" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({ message: "Agar yeh email registered hai, toh reset link bhej diya gaya hai." });
    }

    const resetTokenRaw = crypto.randomBytes(32).toString("hex");

    user.resetToken = crypto.createHash("sha256").update(resetTokenRaw).digest("hex");
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;

    await user.save();

    const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${clientUrl}/reset-password.html?token=${resetTokenRaw}`;

    const mailOptions = {
      from: `"Alora Radiance" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request - Alora Radiance",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2A2A24;">Password Reset Request</h2>
          <p>Aapne password reset karne ki request ki hai. Niche diye gaye link par click karke naya password banayein:</p>
          <a href="${resetUrl}" style="background-color: #2A2A24; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0;">Reset Password</a>
          <p style="font-size: 12px; color: #777;">Yeh link sirf 15 minutes ke liye valid hai.</p>
        </div>
      `
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: "Password reset link aapki email par bhej diya gaya hai!" });

  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR:", error);
    res.status(500).json({ message: "Email bhejne me issue aaya.", error: error.message });
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token aur naya password dono zaroori hain." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye!" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Link invalid hai ya expire ho chuka hai!" });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.status(200).json({ success: true, message: "Password kamyabi se badal gaya hai! Ab aap login kar sakte hain." });

  } catch (error) {
    console.error("RESET_PASSWORD_ERROR:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
