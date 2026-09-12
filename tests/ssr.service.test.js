import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBlogArticleSsr, renderProductSsr } from "../backend/services/ssr.service.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");

test("product SSR replaces every crawlable loading placeholder", () => {
  const template = fs.readFileSync(path.join(projectRoot, "frontend", "product.html"), "utf8");
  const html = renderProductSsr(template, {
    _id: "507f1f77bcf86cd799439011",
    slug: "purifying-glow-face-wash",
    name: "Purifying Glow Face Wash",
    description: "A gentle daily cleanser.",
    ingredients: "Saffron Extract, Salicylic Acid, Niacinamide",
    benefits: "Helps clear excess oil.",
    usageInstructions: "Massage onto damp skin and rinse.",
    category: "face",
    imagepath: "/static/face-wash.png",
    variants: [{ volume: "200ml", price: 499, comparePrice: 599, stock: 10 }]
  });

  assert.match(html, /Purifying Glow Face Wash/);
  assert.match(html, /₹ 499/);
  assert.match(html, /Saffron Extract, Salicylic Acid, Niacinamide/);
  assert.doesNotMatch(html, /Loading product formulation details|Loading details|Loading benefits|Loading usage|Loading ingredients/);
});

test("blog SSR includes article copy in the response HTML", () => {
  const template = fs.readFileSync(path.join(projectRoot, "frontend", "post.html"), "utf8");
  const html = renderBlogArticleSsr(template, {
    slug: "salicylic-acid-guide",
    title: "A Salicylic Acid Guide",
    metaDesc: "How salicylic acid helps oily skin.",
    category: "Skincare",
    content: "<h2>What it does</h2><p>It helps unclog pores.</p>",
    createdAt: "2026-01-01T00:00:00.000Z"
  });

  assert.match(html, /A Salicylic Acid Guide/);
  assert.match(html, /It helps unclog pores\./);
  assert.match(html, /href="#heading-1-what-it-does"/);
});
