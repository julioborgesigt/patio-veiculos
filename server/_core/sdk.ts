import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes } from "crypto";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  userId: number;
  username: string;
  role: string;
};

// Server-side token revocation store: jti -> expiry timestamp (ms).
// Prevents use of stolen tokens until they naturally expire.
// NOTE: This is in-memory only — revocations are lost on restart and not shared
// across multiple instances. Use Redis for multi-instance or zero-downtime deploys.
const revokedTokens = new Map<string, number>();

// Hourly cleanup of expired revocations to bound memory usage.
setInterval(() => {
  const now = Date.now();
  revokedTokens.forEach((exp, jti) => {
    if (exp < now) revokedTokens.delete(jti);
  });
}, 60 * 60 * 1000).unref();

class AuthService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    user: { id: number; username: string; role: string },
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_TTL_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();
    const jti = randomBytes(16).toString("hex");

    return new SignJWT({
      jti,
      userId: user.id,
      username: user.username,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { jti, userId, username, role } = payload as Record<string, unknown>;

      if (
        typeof userId !== "number" ||
        typeof username !== "string" ||
        typeof role !== "string"
      ) {
        return null;
      }

      // Reject revoked tokens (e.g. after explicit logout)
      if (typeof jti === "string" && revokedTokens.has(jti)) {
        return null;
      }

      return { userId, username, role };
    } catch {
      return null;
    }
  }

  /** Revokes the session cookie present in the request, if valid. */
  async revokeCurrentSession(req: Request): Promise<void> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    if (!sessionCookie) return;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(sessionCookie, secretKey, {
        algorithms: ["HS256"],
      });
      const { jti, exp } = payload;
      if (typeof jti === "string") {
        const expiresAt = typeof exp === "number" ? exp * 1000 : Date.now() + SESSION_TTL_MS;
        revokedTokens.set(jti, expiresAt);
      }
    } catch {
      // Token already invalid — nothing to revoke
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserById(session.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new AuthService();
