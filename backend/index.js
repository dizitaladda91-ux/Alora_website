import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser"; // Cookie parse karne ke liye
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
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/userAuth.models.js"; 
import Product from "./models/product.models.js";
import Post from "./models/blog.models.js"; 
import { generateSitemapXml } from "./services/sitemap.service.js"; 

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

// Security Rate Limiters (Bypassed for local development, generous thresholds for production)
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
    
    // Only trusted first-party origins may make credentialed browser requests.
    // Wildcard Netlify/Vercel origins would let an unrelated deployment call the
    // API with credentials if cookie settings are relaxed in the future.
    if (
      !origin || 
      allowedOrigins.includes(origin)
    ) {
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

// Razorpay signature must be verified against the exact raw body, before JSON parsing.
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

// A failed Atlas connection should not leave Mongoose requests buffering until
// they time out. API clients receive a clear temporary-unavailable response,
// while static pages can still be served.
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

// Register auth and protected view routes before static files. Otherwise
// express.static serves admin HTML directly and bypasses protectView.
app.use('/', authRoutes);

// ==========================================
// STATIC FILES HANDLER (Fixes Blank Image Issue)
// ==========================================
const frontendRoot = fs.existsSync(path.join(__dirname, '../public_html'))
  ? path.join(__dirname, '../public_html')
  : path.join(__dirname, '../frontend');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/js', express.static(path.join(frontendRoot, 'js')));
app.use('/static', express.static(path.join(frontendRoot, 'static')));
app.use(express.static(frontendRoot));

// Serve the frontend root page for GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'index.html'));
});

// Public storefront routes use readable URLs while product.html?id=... stays
// available for older shared links.
app.get('/products', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'moreproduct.html'));
});

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

    let html = await fs.promises.readFile(productHtmlPath, 'utf8');
    const cleanTitle = String(product.metaTitle || product.name || 'Alora Radiance').replace(/"/g, '&quot;');
    const cleanDesc = String(product.metaDescription || product.description || 'Luxury skincare formulation.').replace(/"/g, '&quot;');

    html = html.replace(/<title>.*?<\/title>/i, `<title>${cleanTitle} | Alora Radiance</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${cleanDesc}">`);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return res.sendFile(productHtmlPath);
  }
});

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
  res.sendFile(path.join(frontendRoot, 'account.html'));
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

// Dynamic SEO Prerender Handler for Blog Articles (Eliminates Google Soft 404 & Guarantees Indexation)
app.get(['/post/:slug', '/blog/:slug', '/blogs/:slug'], async (req, res) => {
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
      // Return genuine HTTP 404 status (Prevents Google Soft 404 error)
      return res.status(404).sendFile(postHtmlPath);
    }

    let html = await fs.promises.readFile(postHtmlPath, 'utf8');

    const cleanTitle = String(blog.metaTitle || blog.title || 'Alora Radiance').replace(/"/g, '&quot;');
    const cleanDesc = String(blog.metaDesc || blog.title || 'Explore expert skincare insights and healthy skin guides by Alora Radiance.').replace(/"/g, '&quot;');
    const cleanKeywords = String(blog.keywords || '').replace(/"/g, '&quot;');
    const canonicalUrl = `https://aloraradiance.com/post/${encodeURIComponent(blog.slug || rawSlug)}`;
    const coverImg = blog.coverImage || 'https://aloraradiance.com/static/logo2.png';
    const absoluteCover = coverImg.startsWith('http') ? coverImg : `https://aloraradiance.com${coverImg.startsWith('/') ? '' : '/'}${coverImg}`;

    // Inject exact Title, Meta Description, Keywords, Canonical & Social OpenGraph
    html = html.replace(/<title id="dynamic-title">.*?<\/title>/i, `<title id="dynamic-title">${cleanTitle} | Alora Radiance</title>`);
    html = html.replace(/<meta id="dynamic-meta-desc" name="description" content="[^"]*">/i, `<meta id="dynamic-meta-desc" name="description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="dynamic-keywords" name="keywords" content="[^"]*">/i, `<meta id="dynamic-keywords" name="keywords" content="${cleanKeywords}">`);
    html = html.replace(/<link id="dynamic-canonical" rel="canonical" href="[^"]*" \/>/i, `<link id="dynamic-canonical" rel="canonical" href="${canonicalUrl}" />`);
    html = html.replace(/<meta id="og-title" property="og:title" content="[^"]*">/i, `<meta id="og-title" property="og:title" content="${cleanTitle}">`);
    html = html.replace(/<meta id="og-desc" property="og:description" content="[^"]*">/i, `<meta id="og-desc" property="og:description" content="${cleanDesc}">`);
    html = html.replace(/<meta id="og-image" property="og:image" content="[^"]*">/i, `<meta id="og-image" property="og:image" content="${absoluteCover}">`);
    html = html.replace(/<meta id="og-url" property="og:url" content="[^"]*">/i, `<meta id="og-url" property="og:url" content="${canonicalUrl}">`);

    if (blog.schema) {
      try {
        const schemaStr = typeof blog.schema === 'string' ? blog.schema : JSON.stringify(blog.schema);
        html = html.replace(/<script id="dynamic-json-ld" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="dynamic-json-ld" type="application/ld+json">\n${schemaStr}\n</script>`);
      } catch (_) {}
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error("Blog SSR SEO error:", err);
    return res.sendFile(postHtmlPath);
  }
});

app.get('/post', (req, res) => {
  res.redirect(302, '/blog');
});

// Blog listing page routes
app.get(['/blog', '/blogs', '/Blog', '/Blog.html', '/blog.html', '/blogs.html'], (req, res) => {
  const target = fs.existsSync(path.join(frontendRoot, 'Blog.html'))
    ? path.join(frontendRoot, 'Blog.html')
    : path.join(frontendRoot, 'blog.html');
  res.sendFile(target);
});

// Auto-resolve direct page-names like /login, /lead, /privacy, /return-refund
// into the corresponding frontend HTML without needing a static config match.
app.get('/:viewName', (req, res, next) => {
  const viewName = String(req.params.viewName || '').trim().toLowerCase();
  if (!viewName || viewName.includes('.')) return next();

  // Skip API and upload-like endpoints that have their own routers.
  if (viewName === 'api' || viewName === 'uploads' || viewName === 'js' || viewName === 'static') {
    return next();
  }

  const target = path.join(frontendRoot, `${viewName}.html`);
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }

  // If the requested page is a dynamic HTML asset, let the server fall through.
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

app.get('/favicon.ico', (req, res) => {
  const target = path.join(frontendRoot, 'static', 'favicon.ico');
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }
  return res.status(204).end();
});

// Global error handler: Ensures all API errors respond with structured JSON
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

// Connect once for both the local server and Vercel's serverless function.
// Vercel invokes the exported Express app itself, so it must not call listen().
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
