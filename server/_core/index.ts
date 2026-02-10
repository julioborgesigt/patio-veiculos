import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./authRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { MAX_BODY_SIZE } from "@shared/const";
import { seedDefaultAdmin } from "../db";
import { logger } from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const isProduction = process.env.NODE_ENV === "production";

  // Trust proxy for rate limiting behind reverse proxies (DOMCloud, Render, etc)
  app.set("trust proxy", 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
  }));

  // CORS configuration - fail-secure: deny all origins in production if not configured
  const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? false : true);
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );

  // General API rate limiting - 100 requests per 15 minutes per IP
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Muitas requisições, tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", apiLimiter);

  // Stricter rate limit for login endpoint - 10 attempts per 15 minutes
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Muitas tentativas de login. Aguarde 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/auth/login", loginLimiter);

  // Body parser with secure size limit
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

  // Health check endpoint for deploy platforms
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Diagnostic endpoint - shows DB connection status and table columns
  app.get("/api/debug/db", async (_req, res) => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) {
        res.json({ error: "Database not available", env: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          DB_USER: !!process.env.DB_USER,
          DB_PASSWORD: !!process.env.DB_PASSWORD,
          DB_NAME: !!process.env.DB_NAME,
          NODE_ENV: process.env.NODE_ENV,
        }});
        return;
      }
      const { sql } = await import("drizzle-orm");
      const [tables] = await db.execute(sql.raw(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
      ));
      const [userCols] = await db.execute(sql.raw(
        "SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION"
      ));
      res.json({ status: "connected", tables, userColumns: userCols });
    } catch (error: unknown) {
      const err = error as Error & { code?: string; sqlMessage?: string };
      res.status(500).json({ error: err.message, code: err.code, sqlMessage: err.sqlMessage });
    }
  });

  // Auth routes (login)
  registerAuthRoutes(app);

  // Seed default admin user on startup
  seedDefaultAdmin().catch((err) => {
    logger.error("[Server]", "Failed to seed admin:", err);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info("[Server]", `Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info("[Server]", `Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  logger.error("[Server]", "Failed to start server:", err);
  process.exit(1);
});
