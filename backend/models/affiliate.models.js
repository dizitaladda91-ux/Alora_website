import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  discountPercent: { type: Number, default: 10, min: 0, max: 50 },
  commissionPercent: { type: Number, default: 10, min: 0, max: 100 },
  active: { type: Boolean, default: true },
  totalClicks: { type: Number, default: 0, min: 0 },
  totalConversions: { type: Number, default: 0, min: 0 },
  totalCommission: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

const affiliateClickSchema = new mongoose.Schema({
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: "AffiliateReferral", required: true, index: true },
  clickId: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  landingPage: { type: String, default: "/", trim: true, maxlength: 500 }
}, { timestamps: true });

const affiliateConversionSchema = new mongoose.Schema({
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: "AffiliateReferral", required: true, index: true },
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  customerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  clickId: { type: String, default: null, trim: true },
  orderAmount: { type: Number, required: true, min: 0 },
  grossAmount: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  commissionAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "approved", "paid", "rejected"], default: "pending" }
}, { timestamps: true });

affiliateConversionSchema.index({ referralId: 1, customerEmail: 1 }, { unique: true });

export const AffiliateReferral = mongoose.models.AffiliateReferral || mongoose.model("AffiliateReferral", referralSchema);
export const AffiliateClick = mongoose.models.AffiliateClick || mongoose.model("AffiliateClick", affiliateClickSchema);
export const AffiliateConversion = mongoose.models.AffiliateConversion || mongoose.model("AffiliateConversion", affiliateConversionSchema);
