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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Cookie Parser registration

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

// ==========================================
// VIEWS & API ROUTING
// ==========================================
app.use('/api/product', productRouter);
app.use('/', authRoutes); // Auth routes matching view pages directly
app.use('/api/queries', queryRoutes);
app.use('/api/lead', leadRoutes);
app.use("/api/payments", paymentRoutes);
app.use('/api/blogs', blogRoutes); 
app.use('/api/reviews', reviewRoutes);

// Database connection & Server Boot
const Port = process.env.PORT || 5000;
db().then(() => {
  app.listen(Port, () => {
      console.log(`Server is running on Port ${Port}`);
  });
});