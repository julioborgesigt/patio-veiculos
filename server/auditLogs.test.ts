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
  withTransaction: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getAuditLogById,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  markAuditLogReverted,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "user" | "admin" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: "admin-user",
    password: "hashed",
    email: "test@example.com",
    name: "Test Admin",
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

  it("lets an authenticated user restore the previous data of an edited vehicle", async () => {
    const caller = appRouter.createCaller(createContext());

    vi.mocked(getAuditLogById).mockResolvedValue({
      id: 10,
      userId: 1,
      username: "regular-user",
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

  it("deletes the vehicle when reverting a creation", async () => {
    const caller = appRouter.createCaller(createContext());

    vi.mocked(getAuditLogById).mockResolvedValue({
      id: 11,
      userId: 1,
      username: "regular-user",
      action: "criar_veiculo",
      entityType: "vehicle",
      entityId: 9,
      description: "Cadastrou veículo",
      previousData: null,
      newData: null,
      reverted: "nao",
      revertedAt: null,
      revertedBy: null,
      createdAt: new Date(),
    });
    vi.mocked(getVehicleById).mockResolvedValue(null);
    vi.mocked(deleteVehicle).mockResolvedValue(true);

    const result = await caller.auditLogs.revert({ id: 11 });

    expect(result).toEqual({ success: true });
    expect(deleteVehicle).toHaveBeenCalledWith(9);
    expect(markAuditLogReverted).toHaveBeenCalledWith(11, 1);
  });

  it("rejects reverting an already-reverted action", async () => {
    const caller = appRouter.createCaller(createContext());

    vi.mocked(getAuditLogById).mockResolvedValue({
      id: 12,
      userId: 1,
      username: "regular-user",
      action: "editar_veiculo",
      entityType: "vehicle",
      entityId: 3,
      description: "Editou veículo",
      previousData: {},
      newData: null,
      reverted: "sim",
      revertedAt: new Date(),
      revertedBy: 1,
      createdAt: new Date(),
    });

    await expect(caller.auditLogs.revert({ id: 12 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(updateVehicle).not.toHaveBeenCalled();
  });
});
