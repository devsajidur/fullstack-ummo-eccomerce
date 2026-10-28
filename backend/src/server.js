import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import {
  requestTracing,
  apiRateLimiter,
  errorHandler,
} from "./middlewares/security.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Enterprise Security Headers & Compression
app.use(helmet());
app.use(compression());
app.use(requestTracing);

// 2. Strict CORS Configuration
const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);

// 3. Body & Cookie Parsing (Strict 100kb payload limit against DoS)
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// 4. Global Rate Limiter
app.use("/api", apiRateLimiter);

// 5. Health Check Endpoint
app.get("/api/v1/health", (req, res) => {
  res.json({
    success: true,
    service: "ummo-ecommerce-enterprise-api",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// 6. Mount Versioned Enterprise Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/webhooks", webhookRoutes);

// 7. 404 & Centralized Error Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(
    `🚀 Ummo-Ecommerce Enterprise API running on http://localhost:${PORT}/api/v1/health`
  );
});
