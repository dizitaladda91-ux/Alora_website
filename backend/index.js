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
app.use('/api/blogs', blogRoutes); 
app.use('/api/reviews', reviewRoutes);

// Connect once for both the local server and Vercel's serverless function.
// Vercel invokes the exported Express app itself, so it must not call listen().
const databaseReady = db().catch((error) => {
  console.error('Database connection failed:', error);
  throw error;
});

if (!process.env.VERCEL) {
  const Port = process.env.PORT || 5000;
  databaseReady.then(() => {
    app.listen(Port, () => {
      console.log(`Server is running on Port ${Port}`);
    });
  });
}

export default app;
