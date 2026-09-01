import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../backend/middlewares/security.middleware.js";
import { getPasswordResetRecipient } from "../backend/controllers/auth.controllers.js";

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
