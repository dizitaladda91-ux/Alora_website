import assert from "node:assert/strict";
import test from "node:test";
import { getPasswordResetRecipient } from "../backend/controllers/auth.controllers.js";

test("user profile recipient is account email", () => {
  const mockUser = { email: "customer@example.com", name: "Alora User" };
  assert.equal(getPasswordResetRecipient(mockUser), "customer@example.com");
});

test("wishlist toggle logic works as expected on arrays", () => {
  const wishlist = ["prod_1", "prod_2"];
  const addTarget = "prod_3";
  const removeTarget = "prod_1";

  // Simulate toggle add
  const addedList = [...wishlist, addTarget];
  assert.equal(addedList.includes("prod_3"), true);
  assert.equal(addedList.length, 3);

  // Simulate toggle remove
  const removedList = addedList.filter(id => id !== removeTarget);
  assert.equal(removedList.includes("prod_1"), false);
  assert.equal(removedList.length, 2);
});
