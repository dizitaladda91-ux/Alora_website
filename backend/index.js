import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
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
import dns from "dns";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/userAuth.models.js"; 

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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
    
    // Allow requests with no origin, Netlify, Vercel preview domains, or matched origins
    if (
      !origin || 
      allowedOrigins.includes(origin) || 
      /\.netlify\.app$/.test(origin) ||
      /\.vercel\.app$/.test(origin)  // 👈 Vercel URLs ke liye ye add kiya hai
    ) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
};


app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // Express 5 ke liye preflight route compatible hai

// Razorpay signature must be verified against the exact raw body, before JSON parsing.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(cookieParser()); // Cookie Parser registration

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

app.get('/product/:id', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'product.html'));
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

app.get(['/account', '/myorders', '/my-orders'], (req, res) => {
  res.sendFile(path.join(frontendRoot, 'myorders.html'));
});

app.get('/track-order', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'trackorder.html'));
});

app.get(['/affiliate', '/affiliate-register'], (req, res) => {
  res.redirect(301, 'https://affiliation.aloraradiance.com/register');
});

// Serve post detail HTML at clean slug route: /post/:slug
app.get('/post/:slug', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'post.html'));
});

app.get('/post', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'post.html'));
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
app.use('/api/product', productRouter);
app.use('/api/queries', queryRoutes);
app.use('/api/lead', leadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/affiliates", affiliateRoutes);
app.use('/api/blogs', blogRoutes); 
app.use('/api/reviews', reviewRoutes);

// Global error handler: Ensures all API errors respond with structured JSON
app.use((err, req, res, next) => {
  console.error("Express Error Handler:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
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
