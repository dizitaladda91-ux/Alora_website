# Alora E-commerce: Production Roadmap

**Goal:** Alora ko ek secure, fast aur daily-operations-ready skincare e-commerce store banana: customer browse kare, confidently payment kare, admin fulfil kare, aur owner growth measure kar sake.

## 1. Current project audit

### Already implemented

- Product catalogue, variants, stock and Cloudinary image uploads
- Search, product detail, cart and Razorpay checkout
- Razorpay signature verification, webhook deduplication, paid-order creation and refund route
- Customer registration/login/password reset and order history
- Admin product, order, lead/query and blog/SEO pages
- Blog, reviews, contact leads, and affiliate/referral tracking
- MongoDB database and Vercel deployment configuration

### Current risks / gaps found in code

| Priority | Area | Missing / risk | Required outcome |
|---|---|---|---|
| P0 | Secrets | Real credentials must never be exposed or committed. `.env.example` is currently ignored too. | Rotate exposed credentials; ignore only `backend/.env`; commit a safe example file. |
| P0 | Admin auth | Admin/SEO login previously compared environment plaintext passwords. | **Implemented:** database-backed bcrypt staff accounts plus one-time bootstrap script; run the migration and remove runtime password variables. |
| P0 | Abuse protection | Public endpoints needed brute-force/spam protection. | **Implemented:** strict route-level rate limits for auth, checkout, forms, reviews and affiliate requests. CAPTCHA remains the next hardening layer. |
| P0 | XSS | Rich content and public text needed sanitization before storage/rendering. | **Implemented:** server-side blog HTML allowlist sanitization; safe URL/JSON-LD handling; public review, lead and query text stripping/length validation. |
| P0 | Validation | Validation is mostly controller-specific and inconsistent. | Schema validation for every public/admin request; safe error responses. |
| P0 | Tests | `npm test` is a placeholder; no automated coverage. | Unit, integration and payment-webhook test suite in CI. |
| P1 | Cart | Two local-storage cart formats are maintained for legacy compatibility. | Migrate once to one cart schema and add optional account cart sync. |
| Fixed | Referral discount | Referral code was stored only for the browser tab, so checkout could lose it. | **Implemented:** 7-day persistent referral tracking, legacy migration, and referral code forwarding to checkout. |
| P1 | Inventory | Stock reduces after captured payment, but is not reserved during the payment window. | Define reservation/oversell policy; add inventory movement ledger. |
| P1 | Fulfilment | Order statuses exist but shipment, courier, tracking number, status timeline and invoice are absent. | Complete operational order workflow. |
| P1 | Notifications | WhatsApp/Google Sheet side-effects are best-effort and have no durable retry queue. | Persist notification jobs, retry failures, show status to admin. |
| P1 | Reviews | Anyone can submit reviews; no rating bounds, verification, moderation or purchase link. | Verified-purchase reviews with moderation/reporting. |
| P1 | SEO | No robots, sitemap, canonical/structured-data baseline was found. | Search-engine-ready product/blog pages. |
| P2 | Frontend architecture | Repeated navbar, auth, cart and DOM logic across plain HTML pages. | Shared components/design tokens; gradual React/Next.js migration only after core flow stabilizes. |
| P2 | Observability | No error monitoring, uptime checks or business funnel dashboard. | Sentry/logging, uptime monitor and conversion analytics. |

## 2. Target customer and operations flow

```text
SEO / Ads / Referral
  -> Landing or product listing -> Product detail -> Cart
  -> Address + coupon/referral validation -> Razorpay checkout
  -> Razorpay webhook -> Order + stock update + notifications
  -> Admin processing -> Shipment tracking -> Delivery
  -> Verified review / reorder / retention campaign
```

## 3. Frontend roadmap

### F1. Storefront essentials

- Responsive homepage with clear value proposition, bestseller/featured sections, trust badges and CTA.
- Category listing with filters: concern, price, ingredients, availability and sort.
- Product page: image gallery/zoom, variant selector, real stock state, price/MRP/savings, benefits, ingredients, how-to-use, FAQs, shipping/return, related products.
- Search with debouncing, empty state and keyboard accessibility.
- Standard loading, empty, network-error and 404 states on every API-dependent page.

**Acceptance:** a mobile user can find a product, choose variant, add to cart and understand delivery/return terms without contacting support.

### F2. Cart and checkout

- Replace dual cart keys with one versioned cart format; migrate existing carts once.
- Server-validate prices, stock, coupon and referral at checkout (price/stock validation already exists; keep it authoritative).
- Checkout sections: contact, full address, pincode/serviceability, order summary, discount, delivery charges, payment.
- Payment failed/cancelled/retry UX; preserve cart and address.
- Guest checkout plus account creation after payment; logged-in users get saved addresses.
- Accessible form labels, inline validation, no `alert()`-only errors.

**Acceptance:** payment failure does not lose cart; a successful payment always leads to a confirmation page or recoverable order lookup.

### F3. Account, trust and retention

- Account profile, address book, orders, tracking timeline and reorder button.
- Verified-purchase review request after delivery; moderation queue for admin.
- Wishlist, back-in-stock alert and bundle/combo recommendations.
- Email/WhatsApp consent UI, abandoned-cart and post-purchase campaign triggers.
- Affiliate landing, referral link/coupon explanation, dashboard and payout status.

### F4. SEO, performance and accessibility

- `robots.txt`, sitemap, canonical URLs, Open Graph/Twitter tags.
- JSON-LD: Organization, Product, Offer, AggregateRating, FAQ and BlogPosting.
- Cloudinary responsive images, WebP/AVIF where available, lazy loading, fixed image dimensions.
- Track Core Web Vitals; target mobile LCP < 2.5 s.
- Keyboard navigation, visible focus, contrast, alt text and semantic headings.

## 4. Backend roadmap

### B1. Security foundation (do first)

- Add `helmet`, Content Security Policy, HSTS, clickjacking and referrer-policy headers.
- Add `express-rate-limit`: strict limits for login/reset/register; separate limits for leads/reviews/queries and checkout.
- Add CAPTCHA (Cloudflare Turnstile or reCAPTCHA) on public forms.
- Use Zod/Joi/express-validator for request DTOs; reject unknown/oversized fields.
- Central error middleware; never send stack traces or raw database/provider errors to browser.
- Use `crypto.timingSafeEqual` for payment signature comparison too.
- Make staff roles database-based; enforce least privilege (`admin`, `seo`, `support`, `fulfilment`, `affiliate`).
- Validate required environment variables at boot: MongoDB, JWT, Razorpay, Cloudinary and mail configuration.

### B2. Commerce domain

- Products: required SKU, unique variant SKU, categories/tags, active/archive state, low-stock threshold.
- Inventory: `InventoryMovement` collection for purchase, sale, refund, damage and manual adjustment.
- Checkout: `PaymentAttempt` already exists; add idempotency key, expiry cleanup and payment-attempt status.
- Inventory policy: reserve stock for 10-15 minutes at checkout or deliberately allow oversell/backorder. Document and test one policy.
- Coupons: create `Coupon` model with code, type, limit, validity, min order, per-user usage and product/category exclusions.
- Orders: tax, shipping fee, discount breakdown, order notes, invoice number, status history and shipment fields.
- Refund/cancel: explicit full/partial refund policy, stock restore audit and customer notification.

### B3. Fulfilment and integrations

- `Shipment` model: courier, AWB/tracking number, label URL, shipped/delivered timestamps, tracking events.
- Admin order actions: filter/search/export, pack-slip, invoice, status timeline, cancellation/refund reason.
- Durable `NotificationJob` outbox for email, WhatsApp, Sheets and affiliate events; retry failed jobs safely.
- Integrate shipping aggregator only after manual shipment fields work correctly.
- Daily backup strategy for MongoDB; restore drill documented.

### B4. Content, reviews and support

- Sanitize blog rich text at write time; permit a restricted HTML allowlist only.
- Add blog draft/publish/scheduled status and author/audit metadata.
- Reviews: rating must be 1-5, status pending/approved/rejected, purchase verification and abuse reporting.
- Leads/queries: validation, consent flag, owner/status/notes, response SLA and export.

### B5. Engineering platform

- API versioning: `/api/v1/...` before larger additions.
- Consistent API shape: `{ success, data, error, meta }`.
- Split controllers into validation -> service -> repository concerns.
- OpenAPI documentation for every endpoint.
- Tests: Vitest/Jest + Supertest; mock Razorpay/Cloudinary/Email.
- CI: install, lint, tests, dependency audit and deploy only on green build.
- Monitoring: Sentry, structured logs, health endpoint, uptime monitor and alerts.

## 5. Phased delivery plan

| Phase | Duration | Deliverables | Definition of done |
|---|---:|---|---|
| 0. Secure baseline | Days 1-4 | Secret rotation, `.gitignore` correction, database staff accounts, rate limits, headers, validation | No plaintext staff auth; secrets not tracked; public endpoints protected. |
| 1. Test the money flow | Days 5-9 | Tests for auth, cart-total validation, create order, webhook duplicates, refund/stock restore | Every payment/order scenario is automated and passing. |
| 2. Checkout & inventory | Week 2 | One cart, address/pincode UX, coupon model, stock reservation/ledger | No cart loss; no unexplained stock changes/oversell. |
| 3. Fulfilment | Week 3 | Order timeline, shipment/tracking, invoice, notification outbox, admin filters | Team can process, ship and resolve any order from admin. |
| 4. Store conversion | Week 4 | Product-detail upgrade, reviews moderation, wishlist/back-in-stock, retention flows | Better product confidence and repeat-purchase flow. |
| 5. SEO & speed | Week 5 | Sitemap/robots/schema/meta, image optimization, Web Vitals work, GA4/Pixel | Pages index correctly and funnel is measurable. |
| 6. Scale & polish | Week 6+ | Analytics dashboard, affiliate payout ledger, CRM, role audit logs, frontend component migration | Operations are measurable and safe for higher order volume. |

## 6. Minimum database additions

- `Address`: user, recipient, phone, address lines, pincode, default flag.
- `Coupon`: rules, validity, usage and exclusions.
- `CouponRedemption`: coupon/customer/order records for idempotent limits.
- `InventoryMovement`: SKU/variant, delta, reason, actor and reference.
- `OrderStatusHistory`: order, from/to status, actor, note and timestamp.
- `Shipment`: courier, tracking/AWB, label, events and timestamps.
- `NotificationJob`: event, payload, channel, attempts, next retry, final status.
- `AuditLog`: staff action, affected entity, before/after summary and actor.

## 7. Go-live checklist

- [ ] Production MongoDB backups and restricted database user/IP access.
- [ ] Environment secrets set in deployment dashboard; no real secret in source control.
- [ ] Razorpay live mode, webhook URL, webhook secret and capture/refund tests verified.
- [ ] Domain HTTPS, canonical domain and redirect policy verified.
- [ ] Transactional email sender/domain configured and tested.
- [ ] Privacy policy, terms, return/refund, shipping and contact pages reviewed.
- [ ] Test purchase, webhook retry, refund, stock restore and shipment flow executed on production-like environment.
- [ ] Error monitoring, uptime alert, analytics and Search Console installed.
- [ ] Admin access is individual, role-based and logged.

## 8. Build order: do not skip

1. Security and credentials
2. Automated payment/order/refund tests
3. Inventory and fulfilment operations
4. Checkout conversion UX
5. SEO/performance/analytics
6. Growth features and frontend migration

Do not start a framework rewrite before phases 0-3 are stable; the current Express payment/order backend can be hardened incrementally without stopping the store.
