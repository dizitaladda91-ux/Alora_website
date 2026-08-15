import crypto from "crypto";
import User from "../models/userAuth.models.js";
import { AffiliateClick, AffiliateConversion, AffiliateReferral } from "../models/affiliate.models.js";

const makeReferralCode = () => `ALORA${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const createUniqueReferral = async (affiliateId) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await AffiliateReferral.create({ affiliateId, code: makeReferralCode() });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error("Could not generate a unique referral code.");
};

export const registerAffiliate = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{10}$/.test(phone) || password.length < 6) {
      return res.status(400).json({ success: false, message: "Name, valid email, 10-digit phone, and a 6-character password are required." });
    }
    if (await User.exists({ $or: [{ email }, { phone }] })) {
      return res.status(409).json({ success: false, message: "An account already exists with this email or phone number." });
    }
    const user = await User.create({ name, email, phone, password, role: "affiliate" });
    const referral = await createUniqueReferral(user._id);
    return res.status(201).json({ success: true, message: "Affiliate account created. Please sign in to access your dashboard.", referralCode: referral.code });
  } catch (error) {
    console.error("Affiliate registration failed:", error.message);
    return res.status(500).json({ success: false, message: "Could not create affiliate account." });
  }
};

export const trackReferralClick = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const clickId = String(req.body.clickId || "").trim();
    const landingPage = String(req.body.landingPage || "/").trim();
    if (!/^[A-Z0-9_-]{5,64}$/.test(code) || !/^[A-Za-z0-9_-]{8,120}$/.test(clickId)) {
      return res.status(400).json({ success: false, message: "Invalid referral tracking data." });
    }
    const referral = await AffiliateReferral.findOne({ code, active: true }).lean();
    if (!referral) return res.status(404).json({ success: false, message: "Referral code is inactive or invalid." });
    try {
      await AffiliateClick.create({ referralId: referral._id, clickId, landingPage });
      await AffiliateReferral.updateOne({ _id: referral._id }, { $inc: { totalClicks: 1 } });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    return res.status(200).json({ success: true, referralCode: referral.code, clickId });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Referral tracking failed." });
  }
};

export const getAffiliateDashboard = async (req, res) => {
  try {
    const referral = await AffiliateReferral.findOne({ affiliateId: req.user.id }).lean();
    if (!referral) return res.status(404).json({ success: false, message: "Affiliate profile not found." });
    const conversions = await AffiliateConversion.find({ referralId: referral._id }).sort({ createdAt: -1 }).limit(100).lean();
    const pendingCommission = conversions.filter((item) => item.status === "pending" || item.status === "approved").reduce((sum, item) => sum + item.commissionAmount, 0);
    const paidCommission = conversions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.commissionAmount, 0);
    return res.status(200).json({ success: true, referral, conversions, summary: { pendingCommission, paidCommission } });
  } catch {
    return res.status(500).json({ success: false, message: "Could not load affiliate dashboard." });
  }
};

export const updateAffiliateReferral = async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.active === "boolean") update.active = req.body.active;
    for (const field of ["discountPercent", "commissionPercent"]) {
      if (req.body[field] !== undefined) update[field] = Number(req.body[field]);
    }
    const referral = await AffiliateReferral.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
    if (!referral) return res.status(404).json({ success: false, message: "Referral not found." });
    return res.status(200).json({ success: true, referral });
  } catch {
    return res.status(400).json({ success: false, message: "Could not update referral." });
  }
};

export const updateConversionStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!["pending", "approved", "paid", "rejected"].includes(status)) return res.status(400).json({ success: false, message: "Invalid conversion status." });
    const conversion = await AffiliateConversion.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!conversion) return res.status(404).json({ success: false, message: "Conversion not found." });
    return res.status(200).json({ success: true, conversion });
  } catch {
    return res.status(400).json({ success: false, message: "Could not update conversion." });
  }
};
