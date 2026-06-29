import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { HttpError } from "@shared/_core/errors";
import { sdk } from "./sdk";
import { logger } from "./logger";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // HttpError = expected auth failure (missing/invalid/expired cookie, deleted user).
    // Anything else is unexpected (DB down, bug, etc.) and worth logging.
    if (!(error instanceof HttpError)) {
      logger.warn("[Auth]", "Unexpected authentication error:", error);
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
