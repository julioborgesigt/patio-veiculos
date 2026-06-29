import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { vehiclesRouter } from "./routers/vehicles";
import { auditLogsRouter } from "./routers/auditLogs";

export const appRouter = router({
  auth: authRouter,
  vehicles: vehiclesRouter,
  auditLogs: auditLogsRouter,
});

export type AppRouter = typeof appRouter;
