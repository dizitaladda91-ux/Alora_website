import User from "../models/userAuth.models.js";
import Lead from "../models/lead.models.js";
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

  const rawExpires = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || process.env.JWT_EXPIRES;
  let expiresIn = '1d';
  if (rawExpires && String(rawExpires).trim()) {
    const cleaned = String(rawExpires).trim();
    if (!isNaN(cleaned)) {
      expiresIn = Number(cleaned);
    } else if (/^\d+[smhdw]$/i.test(cleaned)) {
      expiresIn = cleaned;
    }
  }

  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn });
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
    const { name, email, password, phone, address, source } = req.body;

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
      address: String(address || '').trim(),
      role: "user" 
    });

    // A newly registered customer is a lead by definition. Using the account
    // email as the key avoids creating a new lead every time they checkout.
    await Lead.findOneAndUpdate(
      { email: user.email },
      {
        $set: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address || '',
          source: String(source || 'registration').trim()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Registration should leave the customer signed in immediately. This also
    // makes checkout account creation a single step rather than register + login.
    const token = generateToken(user._id, user.role);
    res.cookie("token", token, authCookieOptions);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, address: user.address, role: user.role }
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

    const cleanEmail = email.toLowerCase().trim();

    // Every account, including admin and SEO staff, authenticates through the
    // database so passwords are bcrypt-hashed and can be individually managed.
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id, user.role);

    res.cookie("token", token, authCookieOptions);
    
    res.status(200).json({ 
      success: true,
      message: 'Login successful!', 
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, address: user.address, role: user.role }
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
    const { id } = req.user;

    const user = await User.findById(id).select("name email phone address role").lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Session user no longer exists." });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load session." });
  }
};

// Lets an authenticated customer add their address from checkout when their
// account was created earlier from the normal registration page.
export const updateProfile = async (req, res) => {
  try {
    const address = String(req.body?.address || '').trim();
    if (!address) {
      return res.status(400).json({ success: false, message: "Delivery address is required." });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { address } },
      { new: true, runValidators: true }
    ).select("name email phone address role").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not save the delivery address." });
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
