import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import {
  getUserByUsername,
  verifyPassword,
  dummyPasswordCompare,
  updateLastSignedIn,
  createAuditLog,
} from "../db";
import { consumeLoginAttempt, resetLoginAttempts } from "../_core/loginRateLimit";
import { logger } from "../_core/logger";

export const authRouter = router({
  me: publicProcedure.query((opts) => {
    // Nunca expor o objeto User cru: ele inclui o hash de senha. Retorna
    // apenas os campos públicos (mesmo shape do retorno de `login`).
    const user = opts.ctx.user;
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  }),
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req.ip || "unknown";

      // Rate limit por IP — protege o login tRPC contra brute-force
      // (o limiter REST não cobre /api/trpc).
      if (!consumeLoginAttempt(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Muitas tentativas de login. Aguarde 15 minutos.",
        });
      }

      const user = await getUserByUsername(input.username);

      if (!user) {
        // Executa um hash às cegas para igualar o tempo de resposta e
        // evitar enumeração de usuários por timing.
        dummyPasswordCompare(input.password);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuário ou senha inválidos",
        });
      }

      const passwordValid = verifyPassword(input.password, user.password);

      if (!passwordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuário ou senha inválidos",
        });
      }

      // Login válido — zera o contador de tentativas do IP.
      resetLoginAttempts(ip);

      await updateLastSignedIn(user.id);

      const sessionToken = await sdk.createSessionToken(
        { id: user.id, username: user.username, role: user.role },
        { expiresInMs: SESSION_TTL_MS }
      );

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });

      // Log de login (best-effort: não falha o login se a auditoria falhar)
      try {
        await createAuditLog({
          userId: user.id,
          username: user.username,
          action: "login",
          entityType: "user",
          entityId: user.id,
          description: `${user.username} fez login no sistema`,
        });
      } catch (err) {
        logger.error("[Auth]", "Falha ao registrar log de login:", err);
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      };
    }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
