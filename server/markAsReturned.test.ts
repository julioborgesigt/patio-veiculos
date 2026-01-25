import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("vehicles.markAsReturned", () => {
  it("should mark vehicle as returned and update pericia status to feita", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a test vehicle
    const vehicle = await caller.vehicles.create({
      placaOriginal: "TEST1234",
      numeroProcedimento: "001-00001/2026",
      numeroProcesso: "0000001-00.2026.8.06.0001",
      statusPericia: "pendente",
      devolvido: "nao",
    });

    expect(vehicle.devolvido).toBe("nao");
    expect(vehicle.statusPericia).toBe("pendente");
    expect(vehicle.dataDevolucao).toBeNull();

    // Mark as returned
    const updatedVehicle = await caller.vehicles.markAsReturned({ id: vehicle.id });

    expect(updatedVehicle.devolvido).toBe("sim");
    expect(updatedVehicle.statusPericia).toBe("feita");
    expect(updatedVehicle.dataDevolucao).toBeInstanceOf(Date);
  });
});
