import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // GBIF API Proxy Routes
  // This proxies GBIF requests server-side, bypassing browser-side CORS,
  // iframe sandboxing, and adblocker-related fetch failures.
  app.get("/api/gbif/*", async (req, res) => {
    try {
      const subPath = req.params[0] || "";
      const queryParams = new URLSearchParams();
      
      // Copy all query parameters
      Object.entries(req.query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => queryParams.append(key, String(v)));
        } else if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });

      const queryString = queryParams.toString();
      const targetUrl = `https://api.gbif.org/v1/${subPath}${queryString ? "?" + queryString : ""}`;

      console.log(`[GBIF Proxy] Fetching: ${targetUrl}`);

      const response = await fetch(targetUrl);
      
      if (!response.ok) {
        console.error(`[GBIF Proxy Error] Target returned status ${response.status}`);
        return res.status(response.status).json({
          error: `GBIF returned status ${response.status}`,
          status: response.status
        });
      }

      const data = await response.json();
      return res.json(data);
    } catch (err: any) {
      console.error("[GBIF Proxy Exception]:", err);
      return res.status(500).json({
        error: err.message || "Failed to fetch from GBIF server"
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development vs static serve for production
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
