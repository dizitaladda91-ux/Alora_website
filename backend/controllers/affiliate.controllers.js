import crypto from "crypto";
import User from "../models/userAuth.models.js";
import Order from "../models/order.models.js";
import { AffiliateClick, AffiliateConversion, AffiliateReferral } from "../models/affiliate.models.js";
import { createAffiliateClick } from "../services/affiliate.service.js";

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
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User with this email already exists." });
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
    const customerEmail = String(req.body.customerEmail || req.user?.email || "").trim().toLowerCase();

    if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Invalid referral tracking data." });
    }

    if (customerEmail) {
      const usedOrder = await Order.findOne({
        $and: [
          { "customer.email": { $regex: new RegExp(`^${customerEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
          ...(req.user?.id && /^[0-9a-fA-F]{24}$/.test(req.user.id) ? [{ userId: req.user.id }] : [])
        ],
        $or: [
          { appliedCoupons: code },
          { "referral.code": code }
        ]
      }).lean();

      if (usedOrder) {
        return res.status(400).json({ success: false, message: `Coupon '${code}' has already been redeemed on your account and can only be used once.` });
      }
    }

    if (code === "GLOW10") {
      return res.status(200).json({ success: true, referralCode: "GLOW10", clickId: null, discountPercent: 10 });
    }

    if (code === "RAKHI30" || code === "RAKHI" || code === "FESTIVE30" || code === "RAKHI30OFF") {
      return res.status(200).json({ success: true, referralCode: code, clickId: null, discountPercent: 30 });
    }

    const click = await createAffiliateClick({ referralCode: code });
    return res.status(200).json({ success: true, ...click });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message || "Referral tracking failed." });
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
    const referral = await AffiliateReferral.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true }).lean();
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
    const conversion = await AffiliateConversion.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' }).lean();
    if (!conversion) return res.status(404).json({ success: false, message: "Conversion not found." });
    return res.status(200).json({ success: true, conversion });
  } catch {
    return res.status(400).json({ success: false, message: "Could not update conversion." });
  }
};
