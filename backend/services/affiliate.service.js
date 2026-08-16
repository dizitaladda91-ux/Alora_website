const getAffiliateApiBaseUrl = () => {
  const url = String(process.env.AFFILIATE_API_URL || "").trim().replace(/\/+$/, "");
  if (!url || !process.env.STOREFRONT_API_KEY) {
    throw new Error("Affiliate integration is not configured. Set AFFILIATE_API_URL and STOREFRONT_API_KEY.");
  }
  return url;
};

const affiliateRequest = async (path, options = {}) => {
  const response = await fetch(`${getAffiliateApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "X-Storefront-Api-Key": process.env.STOREFRONT_API_KEY,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || body?.error || `Affiliate API request failed (${response.status}).`);
  return body?.data ?? body;
};

export const validateReferral = async ({ referralCode, customerEmail }) => {
  if (!referralCode || !customerEmail) return { valid: false, eligible: false, discountPercent: 0 };
  const code = String(referralCode).trim().toUpperCase();
  const email = String(customerEmail).trim().toLowerCase();
  const data = await affiliateRequest(`/referrals/coupon-status/${encodeURIComponent(code)}?customerEmail=${encodeURIComponent(email)}`);
  return { valid: data.valid === true, eligible: data.eligible === true, discountPercent: Number(data.discountPercent || 0) };
};

// Click IDs are issued by the affiliate platform and tied to a referral code.
export const createAffiliateClick = async ({ referralCode }) => {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,50}$/.test(code)) throw new Error("Invalid referral code.");
  const data = await affiliateRequest(`/referrals/click/${encodeURIComponent(code)}`);
  const clickId = data.clickId || data.id;
  if (!clickId) throw new Error("Affiliate API did not return a click ID.");
  return { referralCode: data.referralCode || code, clickId: String(clickId), discountPercent: Number(data.discountPercent || 0) };
};

export const createAffiliateConversion = async (payload) => {
  if (!payload.referralCode || !payload.clickId || !payload.orderId) return null;
  return affiliateRequest("/referrals/conversion", {
    method: "POST",
    body: JSON.stringify({
      referralCode: String(payload.referralCode).trim().toUpperCase(),
      clickId: String(payload.clickId),
      orderId: String(payload.orderId),
      customerEmail: String(payload.customerEmail).trim().toLowerCase(),
      grossAmount: Number(payload.grossAmount || 0),
      discountAmount: Number(payload.discountAmount || 0),
      eligibleAmount: Number(payload.eligibleAmount || payload.amount || 0),
      amount: Number(payload.amount || 0),
      currency: String(payload.currency || "INR").toUpperCase()
    })
  });
};
