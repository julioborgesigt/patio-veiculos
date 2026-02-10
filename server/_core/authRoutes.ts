import { COOKIE_NAME, THIRTY_DAYS_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { logger } from "./logger";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);

      if (!user || !db.verifyPassword(password, user.password)) {
        res.status(401).json({ error: "Usuário ou senha inválidos" });
        return;
      }

      const sessionToken = await sdk.createSessionToken(
        { id: user.id, username: user.username, role: user.role },
        { expiresInMs: THIRTY_DAYS_MS }
      );

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      logger.error("[Auth]", "Login failed:", error);
      res.status(500).json({ error: "Falha no login" });
    }
  });
}
