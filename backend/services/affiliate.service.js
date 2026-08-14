const getAffiliateConfig = () => {
  const baseUrl = String(process.env.AFFILIATE_API_URL || "").replace(/\/$/, "");
  const apiKey = process.env.STOREFRONT_API_KEY;
  return { baseUrl, apiKey, enabled: Boolean(baseUrl && apiKey) };
};

const affiliateFetch = async (path, options = {}) => {
  const config = getAffiliateConfig();
  if (!config.enabled) return null;
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: { "X-Storefront-Api-Key": config.apiKey, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Affiliate service request failed.");
  return data;
};

export const validateReferral = async ({ referralCode, customerEmail }) => {
  if (!referralCode || !customerEmail) return { valid: false, eligible: false, discountPercent: 0 };
  const data = await affiliateFetch(`/referrals/coupon-status/${encodeURIComponent(referralCode)}?customerEmail=${encodeURIComponent(customerEmail)}`);
  return data?.data || data || { valid: false, eligible: false, discountPercent: 0 };
};

export const createAffiliateConversion = async (payload) => {
  if (!payload.referralCode || !payload.clickId) return null;
  return affiliateFetch("/referrals/conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
};
