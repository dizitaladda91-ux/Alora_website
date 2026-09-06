import User from "../models/userAuth.models.js";
import Lead from "../models/lead.models.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  // The storefront does not need cross-site authenticated requests. Strict
  // cookies prevent a third-party site from replaying a logged-in session.
  sameSite: "strict",
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

  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn, issuer: "alora-radiance", audience: "alora-web" });
};

// Older deployments keep the staff credentials in environment variables.  The
// normal path is still a bcrypt-backed database account, but this bridge makes
// those configured credentials usable while ensuring a real user record exists
// for the JWT/session middleware.
const configuredStaffAccounts = () => [
  { email: process.env.ADMIN_EMAIL || process.env.Admin_login_mail, password: process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_login, role: "admin", name: "Alora Admin" },
  { email: process.env.Admin_login_mail, password: process.env.ADMIN_PASSWORD_login || process.env.ADMIN_PASSWORD, role: "admin", name: "Alora Admin" },
  { email: process.env.SEO_EMAIL, password: process.env.SEO_PASSWORD, role: "seoadmin", name: "Alora SEO" }
].filter(({ email, password }) => String(email || "").trim() && String(password || "").trim());

const hasMatchingConfiguredPassword = (candidate, configured) => {
  const candidateBuffer = Buffer.from(String(candidate || ""));
  const configuredBuffer = Buffer.from(String(configured || ""));
  return candidateBuffer.length === configuredBuffer.length
    && crypto.timingSafeEqual(candidateBuffer, configuredBuffer);
};

const findConfiguredStaffUser = async (email, password) => {
  const account = configuredStaffAccounts().find(({ email: configuredEmail, password: configuredPassword }) =>
    String(configuredEmail).trim().toLowerCase() === email
    && hasMatchingConfiguredPassword(password, configuredPassword)
  );

  if (!account) return null;

  let user = await User.findOne({ email });
  if (user) {
    if (user.role !== account.role) {
      user.role = account.role;
      user.password = password;
      await user.save();
    }
    return user;
  }

  // Staff accounts do not need a customer phone number.  Use a deterministic,
  // non-personal placeholder because older collections may retain a unique
  // phone index.
  const staffPhone = `staff-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
  user = await User.create({
    name: account.name,
    email,
    password,
    phone: staffPhone,
    role: account.role
  });
  return user;
};

const getTransporter = () => {
  const user = String(process.env.EMAIL_USER || "").trim();
  const pass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
};

// Password-reset links must always be delivered to the account owner.
export const getPasswordResetRecipient = (user) => String(user?.email || "").trim().toLowerCase();

export const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { rawToken, hashedToken, expiresAt };
};

export const sendVerificationEmail = async (user, rawToken, req) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("EMAIL_USER or EMAIL_PASS not configured. Skipping verification email delivery.");
    return false;
  }

  const clientUrl = process.env.CLIENT_URL || (req ? `${req.protocol}://${req.get("host")}` : "https://aloraradiance.com");
  const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;
  const userName = user.name || "Valued Customer";

  const mailOptions = {
    from: `"Alora Radiance" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `Verify Your Email Address - Alora Radiance`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAF7EE; color: #2A2A24; margin: 0; padding: 20px; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #ECE4CE; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
          .header { background: #2A2A24; padding: 30px 20px; text-align: center; color: #FAF7EE; }
          .header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; color: #FAF7EE; }
          .header p { margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4AF37; }
          .content { padding: 35px 30px; line-height: 1.6; }
          .content h2 { color: #2A2A24; font-size: 20px; margin-top: 0; font-weight: 600; }
          .content p { color: #555550; font-size: 14px; margin-bottom: 20px; }
          .btn-container { text-align: center; margin: 30px 0; }
          .btn { background-color: #8B4513; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; display: inline-block; box-shadow: 0 3px 8px rgba(139,69,19,0.3); }
          .footer { background: #FAF7EE; padding: 20px; text-align: center; font-size: 11px; color: #8C877B; border-top: 1px solid #ECE4CE; }
          .note { font-size: 12px; color: #888; margin-top: 25px; border-top: 1px dashed #E5DFD1; padding-top: 15px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ALORA RADIANCE</h1>
            <p>Luxury Ayurvedic & Botanical Skincare</p>
          </div>
          <div class="content">
            <h2>Welcome, ${userName}!</h2>
            <p>Thank you for creating an account with Alora Radiance. Please verify your email address to confirm your account and receive your verified member badge.</p>
            <div class="btn-container">
              <a href="${verifyUrl}" class="btn" target="_blank">Verify Email Address</a>
            </div>
            <p style="font-size: 13px; color: #666;">This verification link will remain valid for the next <strong>24 hours</strong>.</p>
            <div class="note">
              <p style="margin: 0 0 5px 0;">If the button above does not work, copy and paste this link into your browser:</p>
              <a href="${verifyUrl}" style="color: #8B4513; text-decoration: underline;">${verifyUrl}</a>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Alora Radiance. All rights reserved.</p>
            <p style="margin: 4px 0 0 0;">Crafted with pure botanicals & active skincare essentials.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await transporter.sendMail(mailOptions);
};

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

    // 3. Safe UpperCase Conversion & Creation with Verification Token
    const formattedName = String(name).trim().toUpperCase();
    const { rawToken, hashedToken, expiresAt } = generateVerificationToken();

    const user = await User.create({ 
      name: formattedName, 
      email: email.toLowerCase().trim(), 
      password, 
      phone: phone.trim(),
      address: String(address || '').trim(),
      role: "user",
      isEmailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: expiresAt
    });

    // Send verification email asynchronously
    try {
      await sendVerificationEmail(user, rawToken, req);
    } catch (mailErr) {
      console.warn("Could not send verification email on register:", mailErr.message);
    }

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
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Unverified accounts are not logged in until email verification completes
    res.status(201).json({
      success: true,
      isUnverified: true,
      email: user.email,
      message: 'Registration successful! Verification email sent.',
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        address: user.address, 
        role: user.role,
        isEmailVerified: false
      }
    });
  } catch (error) {
    console.error("REGISTER_ERROR:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ==========================================
// EMAIL VERIFICATION CONTROLLERS
// ==========================================
export const verifyEmail = async (req, res) => {
  try {
    const token = String(req.query.token || req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ success: false, message: "Verification token is required." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: "This email verification link is invalid or has expired. Please request a new verification link." 
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully! Your account now has a verified blue tick badge.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: true
      }
    });
  } catch (error) {
    console.error("VERIFY_EMAIL_ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during verification.", error: error.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const targetEmail = req.user?.id 
      ? null 
      : String(req.body?.email || "").toLowerCase().trim();

    let user;
    if (req.user?.id) {
      user = await User.findById(req.user.id);
    } else if (targetEmail) {
      user = await User.findOne({ email: targetEmail });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: "Your email is already verified." });
    }

    const { rawToken, hashedToken, expiresAt } = generateVerificationToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = expiresAt;
    await user.save();

    try {
      await sendVerificationEmail(user, rawToken, req);
    } catch (mailErr) {
      console.warn("Could not send verification email on resend:", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Verification email has been sent! Please check your inbox."
    });
  } catch (error) {
    console.error("RESEND_VERIFICATION_ERROR:", error);
    return res.status(500).json({ success: false, message: "Could not send verification email.", error: error.message });
  }
};

// ==========================================
// REAL-TIME POLLING FOR LIVE AUTO-LOGIN
// ==========================================
export const pollVerificationStatus = async (req, res) => {
  try {
    const email = String(req.body?.email || req.query?.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, verified: false, message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, verified: false, message: "Account not found." });
    }

    if (!user.isEmailVerified) {
      return res.status(200).json({ success: true, verified: false, message: "Waiting for email verification." });
    }

    // User is verified -> issue JWT session cookie and auto-login!
    const token = generateToken(user._id, user.role);
    res.cookie("token", token, authCookieOptions);

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Email verified successfully! Logging you in...",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isEmailVerified: true
      }
    });
  } catch (error) {
    console.error("POLL_VERIFICATION_ERROR:", error);
    return res.status(500).json({ success: false, verified: false, message: "Server error during verification polling." });
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

    let user = await findConfiguredStaffUser(cleanEmail, password);
    if (!user) {
      user = await User.findOne({ email: cleanEmail });
      if (!user || !(await user.comparePassword(password))) {
        user = null;
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Customer accounts MUST be email verified before allowing login
    if (user.role === "user" && !user.isEmailVerified) {
      try {
        const { rawToken, hashedToken, expiresAt } = generateVerificationToken();
        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = expiresAt;
        await user.save();
        await sendVerificationEmail(user, rawToken, req);
      } catch (err) {
        console.warn("Could not resend email on unverified login attempt:", err.message);
      }

      return res.status(403).json({
        success: false,
        isUnverified: true,
        email: user.email,
        message: "Aapka email verify nahi hai. Kripya pehle email verify karein! Humne aapko naya verification link bhej diya hai."
      });
    }

    const token = generateToken(user._id, user.role);

    res.cookie("token", token, authCookieOptions);
    
    const response = {
      success: true,
      message: 'Login successful!', 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        address: user.address, 
        role: user.role,
        isEmailVerified: user.isEmailVerified || false
      }
    };

    response.token = token;
    res.status(200).json(response);
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
    path: "/"
  });
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

// Returns the currently authenticated user without exposing the JWT to browser JavaScript.
export const getSession = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id).select("name email phone address role title dob gender wishlist isEmailVerified createdAt").lean();
    if (!user) {
      return res.status(401).json({ success: false, message: "Session user no longer exists." });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load session." });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const updateData = {};
    if (body.title !== undefined) updateData.title = String(body.title || '').trim();
    if (body.name !== undefined && String(body.name).trim()) updateData.name = String(body.name).trim();
    if (body.phone !== undefined && String(body.phone).trim()) updateData.phone = String(body.phone).trim();
    if (body.dob !== undefined) updateData.dob = String(body.dob || '').trim();
    if (body.gender !== undefined) updateData.gender = String(body.gender || '').trim();
    if (body.address !== undefined) updateData.address = String(body.address || '').trim();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No profile details were provided." });
    }

    // If phone is updated, verify it is not already taken by another user
    if (updateData.phone) {
      const existingPhone = await User.findOne({ phone: updateData.phone, _id: { $ne: req.user.id } });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: "Phone number already registered with another account." });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).select("name email phone address role title dob gender wishlist isEmailVerified createdAt").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user
    });
  } catch (error) {
    console.error("UPDATE_PROFILE_ERROR:", error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const accountEmail = String(email || req.body.accountEmail || "").trim().toLowerCase();

    if (!accountEmail) return res.status(400).json({ message: "Account Email enter karein!" });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ message: ".env file me EMAIL_USER ya EMAIL_PASS missing hai!" });
    }

    const user = await User.findOne({ email: accountEmail });
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
      // Never accept a client-provided delivery address here. Otherwise an
      // attacker could request a reset for another account and receive that
      // account's reset token in their own inbox.
      to: getPasswordResetRecipient(user),
      subject: `Password Reset Request for Account (${accountEmail}) - Alora Radiance`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2A2A24;">Password Reset Request</h2>
          <p>Account Email: <strong>${accountEmail}</strong> ke liye password reset link request kiya gaya hai.</p>
          <p>Niche diye gaye link par click karke naya password banayein:</p>
          <a href="${resetUrl}" style="background-color: #2A2A24; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0;">Reset Password</a>
          <p style="font-size: 12px; color: #777;">Yeh link sirf 15 minutes ke liye valid hai.</p>
        </div>
      `
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    res.status(200).json({ 
      success: true, 
      message: "Agar yeh email registered hai, toh reset link bhej diya gaya hai."
    });

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
