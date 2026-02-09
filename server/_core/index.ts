import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./authRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { MAX_BODY_SIZE } from "@shared/const";
import { seedDefaultAdmin, getDb, getUserByUsername } from "../db";

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

  // Trust proxy for rate limiting behind reverse proxies (Render, Railway, etc)
  app.set("trust proxy", 1);

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    })
  );

  // Rate limiting - 100 requests per 15 minutes per IP
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Muitas requisições, tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", apiLimiter);

  // Body parser with secure size limit
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

  // Health check endpoint for deploy platforms
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Debug endpoint para diagnóstico em produção
  app.get("/api/debug-status", async (_req, res) => {
    try {
      const db = await getDb();
      const dbConnected = db !== null;
      let adminInfo: string = "DB not connected";
      let userCount: number | string = "unknown";

      if (db) {
        try {
          const admin = await getUserByUsername("admin");
          adminInfo = admin
            ? `Found: id=${admin.id}, username=${admin.username}, role=${admin.role}, pwdLen=${admin.password?.length}`
            : "NOT FOUND";
          const countResult = await db.execute("SELECT COUNT(*) as cnt FROM users");
          userCount = (countResult as any)?.[0]?.[0]?.cnt ?? "query ok but no count";
        } catch (dbErr: unknown) {
          adminInfo = `DB query error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`;
        }
      }

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          hasDATABASE_URL: !!process.env.DATABASE_URL,
          hasDB_USER: !!process.env.DB_USER,
          hasDB_PASSWORD: !!process.env.DB_PASSWORD,
          hasDB_NAME: !!process.env.DB_NAME,
          hasJWT_SECRET: !!process.env.JWT_SECRET,
          hasADMIN_USER: !!process.env.ADMIN_USER,
          hasADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
        },
        database: {
          connected: dbConnected,
          adminUser: adminInfo,
          totalUsers: userCount,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: msg });
    }
  });

  // Auth routes (login)
  registerAuthRoutes(app);

  // Log startup env info
  console.log("[STARTUP] ENV:", {
    NODE_ENV: process.env.NODE_ENV,
    hasDATABASE_URL: !!process.env.DATABASE_URL,
    hasDB_USER: !!process.env.DB_USER,
    hasDB_PASSWORD: !!process.env.DB_PASSWORD,
    hasDB_NAME: !!process.env.DB_NAME,
    hasJWT_SECRET: !!process.env.JWT_SECRET,
    hasADMIN_USER: !!process.env.ADMIN_USER,
    hasADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
  });

  // Seed default admin user on startup
  const db = await getDb();
  console.log("[STARTUP] DB connected:", db !== null);
  seedDefaultAdmin().catch(console.error);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
