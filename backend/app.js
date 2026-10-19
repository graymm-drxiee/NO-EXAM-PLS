const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const laptopRoutes = require("./routes/laptopRoutes");
const loanRoutes = require("./routes/loanRoutes");
const adminRoutes = require("./routes/adminRoutes");

function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) =>
        !origin || allowedOrigins.includes(origin)
          ? callback(null, true)
          : callback(new Error("Origin not allowed by CORS")),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.use(express.json({ limit: "100kb" }));

  // Minimal request log. Skipped under test to keep the output readable.
  if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  }

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes);
  app.use("/api/laptops", laptopRoutes);
  app.use("/api/loans", loanRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

  // Central error handler: every response the SPA shows comes from `message`.
  app.use((err, _req, res, _next) => {
    let status = err.status || 500;
    let message = err.message;

    if (err.name === "ValidationError") {
      status = 400;
      message = Object.values(err.errors).map((e) => e.message)[0] || "Invalid data.";
    } else if (err.code === 11000) {
      status = 400;
      message = err.keyPattern?.tag
        ? "That asset tag is already in use."
        : "That record already exists.";
    } else if (err.name === "CastError") {
      status = 404;
      message = "Not found.";
    }

    if (status >= 500) console.error(err);
    res.status(status).json({ message: status >= 500 ? "Internal Server Error" : message });
  });

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  require("./server").startServer().catch((err) => {
    console.error("Startup failed:", err.message);
    process.exitCode = 1;
  });
}
