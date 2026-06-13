import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  getVehicleById: vi.fn(),
  listVehicles: vi.fn(),
  getVehicleStats: vi.fn(),
  getAllVehiclesForExport: vi.fn(),
  findVehicleByPlaca: vi.fn(),
  getUserByUsername: vi.fn(),
  verifyPassword: vi.fn(),
  dummyPasswordCompare: vi.fn(),
  hashPassword: vi.fn(),
  getUserById: vi.fn(),
  updateLastSignedIn: vi.fn(),
  seedDefaultAdmin: vi.fn(),
  isDuplicateKeyError: vi.fn(() => false),
  createAuditLog: vi.fn(),
  listAuditLogs: vi.fn(),
  getAuditLogById: vi.fn(),
  markAuditLogReverted: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getAuditLogById,
  getVehicleById,
  updateVehicle,
  markAuditLogReverted,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "user" | "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: role === "admin" ? "admin-user" : "regular-user",
    password: "hashed",
    email: "test@example.com",
    name: "Test User",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("auditLogs.revert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.auditLogs.revert({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // Não deve sequer consultar o log se o usuário não for admin
    expect(getAuditLogById).not.toHaveBeenCalled();
  });

  it("lets an admin restore the previous data of an edited vehicle", async () => {
    const caller = appRouter.createCaller(createContext("admin"));

    vi.mocked(getAuditLogById).mockResolvedValue({
      id: 10,
      userId: 1,
      username: "admin-user",
      action: "editar_veiculo",
      entityType: "vehicle",
      entityId: 7,
      description: "Editou veículo",
      previousData: {
        placaOriginal: "ABC1234",
        marca: "Fiat",
        statusPericia: "pendente",
        devolvido: "nao",
      },
      newData: null,
      reverted: "nao",
      revertedAt: null,
      revertedBy: null,
      createdAt: new Date(),
    });
    vi.mocked(getVehicleById).mockResolvedValue(null);
    vi.mocked(updateVehicle).mockResolvedValue(null);

    const result = await caller.auditLogs.revert({ id: 10 });

    expect(result).toEqual({ success: true });
    expect(updateVehicle).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ placaOriginal: "ABC1234", marca: "Fiat" })
    );
    expect(markAuditLogReverted).toHaveBeenCalledWith(10, 1);
  });
});
