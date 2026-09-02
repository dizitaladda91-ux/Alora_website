import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCheckoutTotals,
  getRequestedCouponCodes,
  normalizeCheckoutItems
} from "../backend/controllers/payment.controllers.js";
import { inventoryTrackingEnabled } from "../backend/config/inventory.js";

test("checkout totals are calculated on the server with delivery rules", () => {
  assert.deepEqual(
    calculateCheckoutTotals({ subtotal: 400, discountPercent: 10, founderHandDelivery: false }),
    { affiliateDiscount: 40, deliveryCharge: 40, founderDeliveryCharge: 0, totalAmount: 400 }
  );
  assert.deepEqual(
    calculateCheckoutTotals({ subtotal: 600, discountPercent: 10, founderHandDelivery: true }),
    { affiliateDiscount: 60, deliveryCharge: 0, founderDeliveryCharge: 5000, totalAmount: 5540 }
  );
  assert.deepEqual(
    calculateCheckoutTotals({ subtotal: 499, discountPercent: 0, flatDiscount: 490, founderHandDelivery: false }),
    { affiliateDiscount: 490, deliveryCharge: 0, founderDeliveryCharge: 0, totalAmount: 9 }
  );
  assert.deepEqual(
    calculateCheckoutTotals({ subtotal: 450, discountPercent: 0, flatDiscount: 490, founderHandDelivery: false }),
    { affiliateDiscount: 450, deliveryCharge: 40, founderDeliveryCharge: 0, totalAmount: 40 }
  );
});

test("coupon codes are normalised, deduplicated, and validated", () => {
  assert.deepEqual(
    getRequestedCouponCodes({ couponCodes: [" glow10 ", "GLOW10"], referral: { code: "ref-123" } }),
    ["GLOW10", "REF-123"]
  );
  assert.throws(() => getRequestedCouponCodes({ couponCode: "not valid!" }), /invalid/);
});

test("checkout item normalisation rejects invalid quantities", () => {
  assert.deepEqual(
    normalizeCheckoutItems([
      { id: "product-one__100ml", size: "100ml", qty: 2 },
      { productId: "product-two", size: "50ml", qty: 1.5 }
    ]),
    [{ productId: "product-one", variant: "100ml", quantity: 2 }]
  );
});

test("inventory tracking remains disabled unless explicitly enabled", () => {
  const original = process.env.INVENTORY_TRACKING_ENABLED;
  delete process.env.INVENTORY_TRACKING_ENABLED;
  assert.equal(inventoryTrackingEnabled(), false);
  process.env.INVENTORY_TRACKING_ENABLED = "true";
  assert.equal(inventoryTrackingEnabled(), true);
  if (original === undefined) delete process.env.INVENTORY_TRACKING_ENABLED;
  else process.env.INVENTORY_TRACKING_ENABLED = original;
});
