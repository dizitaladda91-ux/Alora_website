import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import db from "./config/db.js";
import productRouter from "./routes/product.routes.js";
import authRoutes from "./routes/auth.routes.js";
import queryRoutes from "./routes/query.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import blogRoutes from "./routes/blog.routes.js"; 
import reviewRoutes from "./routes/review.routes.js";
import orderRoutes from "./routes/order.routes.js";
import affiliateRoutes from "./routes/affiliate.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/userAuth.models.js"; 
import Product from "./models/product.models.js";
import Post from "./models/blog.models.js"; 
import { generateSitemapXml } from "./services/sitemap.service.js"; 
import { parseAndNormalizeSchemas } from "./services/contentSanitizer.service.js"; 
import { renderBlogArticleSsr, renderBlogListSsr, renderProductSsr, renderProductListSsr } from "./services/ssr.service.js";
import { setSecurityHeaders, sanitizeNoSql, createRateLimiter } from "./middlewares/security.middleware.js"; 

if (!process.env.VERCEL) {
    try {
        dns.setServers(["1.1.1.1", "8.8.8.8"]);
    } catch (e) {
        console.warn("DNS server setup warning:", e.message);
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// Security Rate Limiters
const globalLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 2000, message: "Too many API requests. Please slow down." });
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many login/auth attempts. Please try again after 15 minutes." });

// Middleware setup
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5501',
      'http://127.0.0.1:5502',
      'https://aloraproduct.netlify.app',
      'https://aloraradiance.com',
      'https://www.aloraradiance.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
};

app.use(setSecurityHeaders);
app.use(compression());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Razorpay signature must be verified against exact raw body
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());
app.use(sanitizeNoSql);

app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);

// High-Speed HTTP Response Caching for Public Catalog GET Endpoints
app.use(['/api/product/all', '/api/product/search', '/api/products/all', '/api/blogs/all', '/api/blog/all', '/api/blogs', '/api/blog', '/api/reviews'], (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  }
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await db();
    return res.status(200).json({ success: true, database: 'connected' });
  } catch {
    return res.status(503).json({ success: false, database: 'unavailable' });
  }
});

app.get('/api/config/gtm', (req, res) => {
  return res.status(200).json({
    success: true,
    gtmId: (process.env.GTM_ID || "").trim()
  });
});

app.use('/api', async (req, res, next) => {
  try {
    await db();
    return next();
  } catch (err) {
    console.error("Database connection error:", err);
    return res.status(503).json({
      success: false,
      message: 'Database is temporarily unavailable. Please try again shortly.',
      error: err.message
    });
  }
});

app.use('/', authRoutes);

// ==========================================
// STATIC FILES HANDLER
// ==========================================
// Keep the HTML templates available to the serverless function as well as local
// development. `process.cwd()` is the project root on Vercel, whereas __dirname
// is the backend directory locally.
const frontendRootCandidates = [
  path.join(__dirname, '../public_html'),
  path.join(__dirname, '../frontend'),
  path.join(process.cwd(), 'public_html'),
  path.join(process.cwd(), 'frontend')
];
const frontendRoot = frontendRootCandidates.find(candidate => fs.existsSync(candidate))
  || path.join(__dirname, '../frontend');

const sendSsrUnavailable = (res, pageName, err) => {
  console.error(`${pageName} SSR error:`, err);
  // Do not serve a successful page containing client-side "Loading..." text.
  // Search engines will retry a 503 and cannot index that placeholder page.
  res.setHeader('Retry-After', '120');
  return res.status(503).type('html').send('<!doctype html><title>Temporarily unavailable</title><meta name="robots" content="noindex">Please try again shortly.');
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/js', express.static(path.join(frontendRoot, 'js')));
app.use('/static', express.static(path.join(frontendRoot, 'static')));
app.use(express.static(frontendRoot));

// Serve the frontend root page for GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});

// ==========================================
// 🚀 SERVER-SIDE PRE-RENDERING (SSR) ROUTES
// ==========================================

// 1. Product Catalog Listing Page SSR
app.get('/products', async (req, res) => {
  const moreProductHtmlPath = path.join(frontendRoot, 'moreproduct.html');
  try {
    await db();
    const products = await Product.find({ isActive: { $ne: false } }).sort({ isBestseller: -1, createdAt: -1 }).lean();
    const templateHtml = await fs.promises.readFile(moreProductHtmlPath, 'utf8');
    const renderedHtml = renderProductListSsr(templateHtml, products);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(renderedHtml);
  } catch (err) {
    return sendSsrUnavailable(res, 'Products list', err);
  }
});

// 2. Individual Product Detail Page SSR
app.get('/product/:id', async (req, res) => {
  const rawId = String(req.params.id || '').trim();
  const productHtmlPath = path.join(frontendRoot, 'product.html');
  if (!rawId) return res.status(404).sendFile(productHtmlPath);

  try {
    await db();
    const product = await Product.findOne({
      $or: [
        { slug: rawId },
        { slug: decodeURIComponent(rawId) },
        { _id: rawId.match(/^[0-9a-fA-F]{24}$/) ? rawId : null }
      ].filter(Boolean)
    }).lean();

    if (!product) {
      return res.status(404).sendFile(productHtmlPath);
    }

    const templateHtml = await fs.promises.readFile(productHtmlPath, 'utf8');
    const renderedHtml = renderProductSsr(templateHtml, product);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(renderedHtml);
  } catch (err) {
    return sendSsrUnavailable(res, 'Product', err);
  }
});

// 3. Blog Catalog Listing Page SSR
app.get(['/blog', '/blogs', '/Blog', '/Blog.html', '/blog.html', '/blogs.html'], async (req, res) => {
  const target = fs.existsSync(path.join(frontendRoot, 'Blog.html'))
    ? path.join(frontendRoot, 'Blog.html')
    : path.join(frontendRoot, 'blog.html');
  try {
    await db();
    const posts = await Post.find({ status: { $ne: 'draft' } }).sort({ publishedAt: -1, createdAt: -1 }).lean();
    const templateHtml = await fs.promises.readFile(target, 'utf8');
    const renderedHtml = renderBlogListSsr(templateHtml, posts);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(renderedHtml);
  } catch (err) {
    return sendSsrUnavailable(res, 'Blog list', err);
  }
});

// 4. Individual Blog Article Page SSR
app.get(['/blog/:slug', '/blogs/:slug'], async (req, res) => {
  const rawSlug = String(req.params.slug || '').trim();
  const postHtmlPath = path.join(frontendRoot, 'post.html');
  if (!rawSlug) {
    return res.status(404).sendFile(postHtmlPath);
  }

  try {
    await db();
    const blog = await Post.findOne({
      $or: [
        { slug: rawSlug },
        { slug: decodeURIComponent(rawSlug) },
        { _id: rawSlug.match(/^[0-9a-fA-F]{24}$/) ? rawSlug : null }
      ].filter(Boolean),
      status: { $ne: 'draft' }
    }).lean();

    if (!blog) {
      return res.status(404).sendFile(postHtmlPath);
    }

    let relatedProducts = [];
    try {
      if (blog.category) {
        relatedProducts = await Product.find({
          category: new RegExp(blog.category, 'i'),
          isActive: { $ne: false }
        }).limit(3).lean();
      }
      if (relatedProducts.length === 0) {
        relatedProducts = await Product.find({ isActive: { $ne: false } }).limit(3).lean();
      }
    } catch (_) {}

    const templateHtml = await fs.promises.readFile(postHtmlPath, 'utf8');
    const renderedHtml = renderBlogArticleSsr(templateHtml, blog, relatedProducts);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(renderedHtml);
  } catch (err) {
    return sendSsrUnavailable(res, 'Blog article', err);
  }
});

// Other static content routes
app.get('/about', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'aboutus.html'));
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'PrivacyPolicy.html'));
});

app.get('/terms-and-conditions', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'termCondition.html'));
});

app.get('/corporate-governance', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'Corporate Governance.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'KnowledegeFAQ.html'));
});

app.get('/return-refund', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'ReturnRefund.html'));
});

app.get('/certificates', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'certificates.html'));
});

app.get(['/account', '/myorders', '/my-orders', '/profile', '/wishlist'], (req, res) => {
  // Account URLs are utility pages, not public landing pages. Keep them
  // crawlable long enough for Google to receive this directive, but never
  // allow them into the search index.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(frontendRoot, 'account.html'));
});

app.get(['/verify-email', '/verify-email.html'], (req, res) => {
  res.sendFile(path.join(frontendRoot, 'verify-email.html'));
});

app.get('/track-order', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'trackorder.html'));
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/xml');
    await db();
    const xml = await generateSitemapXml();
    res.send(xml);
  } catch (err) {
    console.error("Sitemap generation error:", err);
    res.sendFile(path.join(frontendRoot, 'sitemap.xml'));
  }
});

app.get(['/sitemap', '/sitemap.html'], (req, res) => {
  res.sendFile(path.join(frontendRoot, 'sitemap.html'));
});

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(frontendRoot, 'robots.txt'));
});

app.get(['/llms.txt', '/llms-full.txt'], (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const filename = req.path.includes('full') ? 'llms-full.txt' : 'llms.txt';
  const target = path.join(frontendRoot, filename);
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }
  return res.sendFile(path.join(frontendRoot, 'llms.txt'));
});

app.get(['/affiliate', '/affiliate-register'], (req, res) => {
  res.redirect(301, 'https://affiliation.aloraradiance.com/register');
});

// 301 Permanent Redirects for legacy /post and /post/:slug paths to /blog and /blog/:slug
app.get('/post/:slug', (req, res) => {
  const rawSlug = String(req.params.slug || '').trim();
  if (!rawSlug) return res.redirect(301, '/blog');
  res.redirect(301, `/blog/${encodeURIComponent(rawSlug)}`);
});

app.get('/post', (req, res) => {
  res.redirect(301, '/blog');
});

// Auto-resolve direct page-names
app.get('/:viewName', (req, res, next) => {
  const viewName = String(req.params.viewName || '').trim().toLowerCase();
  if (!viewName || viewName.includes('.')) return next();

  if (viewName === 'api' || viewName === 'uploads' || viewName === 'js' || viewName === 'static') {
    return next();
  }

  const target = path.join(frontendRoot, `${viewName}.html`);
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }

  return next();
});

// ==========================================
// VIEWS & API ROUTING
// ==========================================
app.use(['/api/product', '/api/products'], productRouter);
app.use('/api/queries', queryRoutes);
app.use('/api/lead', leadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/affiliates", affiliateRoutes);
app.use(['/api/blogs', '/api/blog'], blogRoutes); 
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use(['/api/faqs', '/api/faq'], faqRoutes);

app.get('/favicon.ico', (req, res) => {
  const target = path.join(frontendRoot, 'static', 'favicon.ico');
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }
  return res.status(204).end();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Express Error Handler:", err);
  if (res.headersSent) {
    return next(err);
  }

  if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FIELD_VALUE' || err.status === 413 || err.statusCode === 413) {
    return res.status(400).json({
      success: false,
      message: 'Cover image or blog content size is too large. Please upload an image file under 3.5 MB.'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "A server error occurred",
    error: err.message || "A server error occurred"
  });
});

if (!process.env.VERCEL) {
  const Port = process.env.PORT || 5000;
  db()
    .then(() => {
      app.listen(Port, () => {
        console.log(`Server is running on Port ${Port}`);
      });
    })
    .catch(() => {
      process.exitCode = 1;
    });
}

export default app;
