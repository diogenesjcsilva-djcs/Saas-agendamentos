import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/lib/api-routes.js";

// Setup ports and paths
const PORT = 3000;

async function startServer() {
  const app = express();
  app.disable("x-powered-by");

  // Basic Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  // Mount modular API routes
  app.use("/api", apiRouter);

  // Vite Integration for Serving Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Scheduler SaaS server running on port ${PORT}`);
  });
}

startServer();
