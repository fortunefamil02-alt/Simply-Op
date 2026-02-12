import path from "path";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

async function startServer() {
  const app = express();

  // --------------------
  // Static public files
  // --------------------
  const publicDir = path.join(process.cwd(), "server/_core/public");
  app.use(express.static(publicDir));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.get("/dashboard", (_req, res) => {
    res.sendFile(path.join(publicDir, "dashboard.html"));
  });

  // --------------------
  // CORS
  // --------------------
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // --------------------
  // Body parsing
  // --------------------
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --------------------
  // Health check
  // --------------------
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // --------------------
  // tRPC
  // --------------------
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // --------------------
  // Start server
  // --------------------
  const port = Number(process.env.PORT) || 3000;
  const server = createServer(app);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
