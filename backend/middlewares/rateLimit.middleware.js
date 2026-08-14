import rateLimit from "express-rate-limit";

const rateLimitMessage = (message) => ({
  success: false,
  message
});

const createLimiter = ({ windowMs, limit, message }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitMessage(message)
});

// Authentication endpoints are deliberately strict: they are the most common
// brute-force and account-enumeration targets.
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Please try again in 15 minutes."
});

export const registrationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many registration attempts. Please try again later."
});

export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many password-reset attempts. Please try again in an hour."
});

export const publicFormLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many requests. Please wait a few minutes and try again."
});

export const reviewLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many review submissions. Please try again later."
});

export const checkoutLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: "Too many checkout attempts. Please wait a few minutes and try again."
});

export const affiliateRegistrationLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 5,
  message: "Too many affiliate registration attempts. Please try again tomorrow."
});

export const affiliateClickLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: "Too many referral tracking requests. Please try again shortly."
});
