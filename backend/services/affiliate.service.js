import { AffiliateConversion, AffiliateReferral } from "../models/affiliate.models.js";

export const validateReferral = async ({ referralCode, customerEmail }) => {
  if (!referralCode || !customerEmail) return { valid: false, eligible: false, discountPercent: 0 };
  const code = String(referralCode).trim().toUpperCase();
  const email = String(customerEmail).trim().toLowerCase();
  const referral = await AffiliateReferral.findOne({ code, active: true }).populate("affiliateId", "email").lean();
  if (!referral) return { valid: false, eligible: false, discountPercent: 0 };
  if (String(referral.affiliateId?.email || "").toLowerCase() === email) {
    return { valid: false, eligible: false, discountPercent: 0 };
  }

  // One referral discount per customer prevents repeated self-service coupon use.
  const usedBefore = await AffiliateConversion.exists({ referralId: referral._id, customerEmail: email });
  return {
    valid: true,
    eligible: !usedBefore,
    discountPercent: usedBefore ? 0 : referral.discountPercent,
    commissionPercent: referral.commissionPercent
  };
};

export const createAffiliateConversion = async (payload) => {
  if (!payload.referralCode || !payload.orderId) return null;
  const referral = await AffiliateReferral.findOne({ code: String(payload.referralCode).trim().toUpperCase(), active: true });
  if (!referral) return null;

  const commissionPercent = Math.min(100, Math.max(0, Number(payload.commissionPercent ?? referral.commissionPercent) || 0));
  const commissionAmount = Number((Number(payload.eligibleAmount || payload.amount || 0) * commissionPercent / 100).toFixed(2));
  try {
    const conversion = await AffiliateConversion.create({
      referralId: referral._id,
      affiliateId: referral.affiliateId,
      orderId: String(payload.orderId),
      customerEmail: String(payload.customerEmail).trim().toLowerCase(),
      clickId: payload.clickId ? String(payload.clickId) : null,
      orderAmount: Number(payload.amount || 0),
      grossAmount: Number(payload.grossAmount || 0),
      discountAmount: Number(payload.discountAmount || 0),
      commissionAmount
    });
    await AffiliateReferral.updateOne({ _id: referral._id }, { $inc: { totalConversions: 1, totalCommission: commissionAmount } });
    return conversion;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
};
