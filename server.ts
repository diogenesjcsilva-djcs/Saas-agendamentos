import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import apiRouter from "./src/lib/api-routes.js";

// Setup ports and paths
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

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
