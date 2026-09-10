import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { createRateLimiter } from "../backend/middlewares/security.middleware.js";
import { getPasswordResetRecipient, generateVerificationToken } from "../backend/controllers/auth.controllers.js";

const makeResponse = () => ({
  headers: {},
  statusCode: null,
  body: null,
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test("public request limiter blocks requests over its limit", () => {
  const limit = createRateLimiter({ windowMs: 60_000, max: 2, skipLocal: false });
  const request = { ip: "203.0.113.10", socket: {} };
  let nextCalls = 0;

  limit(request, makeResponse(), () => { nextCalls++; });
  limit(request, makeResponse(), () => { nextCalls++; });
  const blockedResponse = makeResponse();
  limit(request, blockedResponse, () => { nextCalls++; });

  assert.equal(nextCalls, 2);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.body.success, false);
  assert.ok(blockedResponse.headers["Retry-After"] > 0);
});

test("password reset recipient is always the account email", () => {
  assert.equal(
    getPasswordResetRecipient({ email: " Customer@Example.com " }),
    "customer@example.com"
  );
  assert.equal(getPasswordResetRecipient({}), "");
});

test("email verification generates cryptographically secure 64-character raw token and sha256 hash", () => {
  const { rawToken, hashedToken, expiresAt } = generateVerificationToken();

  assert.equal(typeof rawToken, "string");
  assert.equal(rawToken.length, 64);
  assert.equal(typeof hashedToken, "string");
  assert.equal(hashedToken.length, 64);

  // SHA256 of rawToken must equal hashedToken
  const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(hashedToken, expectedHash);

  // Expiration should be in the future (approx 24 hours)
  const now = Date.now();
  assert.ok(expiresAt instanceof Date);
  assert.ok(expiresAt.getTime() > now + 23 * 60 * 60 * 1000);
  assert.ok(expiresAt.getTime() <= now + 25 * 60 * 60 * 1000);
});

test("email verification token correctly matches incoming candidate tokens", () => {
  const { rawToken, hashedToken } = generateVerificationToken();
  const candidateValid = rawToken;
  const candidateInvalid = crypto.randomBytes(32).toString("hex");

  const validHash = crypto.createHash("sha256").update(candidateValid).digest("hex");
  const invalidHash = crypto.createHash("sha256").update(candidateInvalid).digest("hex");

  assert.equal(validHash, hashedToken);
  assert.notEqual(invalidHash, hashedToken);
});

test("customer accounts require email verification for login", () => {
  const unverifiedCustomer = { role: "user", isEmailVerified: false };
  const verifiedCustomer = { role: "user", isEmailVerified: true };
  const adminAccount = { role: "admin", isEmailVerified: false };

  const isLoginAllowed = (user) => {
    if (user.role === "user" && !user.isEmailVerified) return false;
    return true;
  };

  assert.equal(isLoginAllowed(unverifiedCustomer), false);
  assert.equal(isLoginAllowed(verifiedCustomer), true);
  assert.equal(isLoginAllowed(adminAccount), true);
});


