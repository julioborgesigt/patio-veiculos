import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/auth";
import { vehiclesRouter } from "./routers/vehicles";
import { auditLogsRouter } from "./routers/auditLogs";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  vehicles: vehiclesRouter,
  auditLogs: auditLogsRouter,
});

export type AppRouter = typeof appRouter;
