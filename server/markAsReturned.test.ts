import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  getVehicleById: vi.fn(),
  listVehicles: vi.fn(),
  getVehicleStats: vi.fn(),
  getAllVehiclesForExport: vi.fn(),
  getUserByUsername: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  getUserById: vi.fn(),
  updateLastSignedIn: vi.fn(),
  seedDefaultAdmin: vi.fn(),
}));

import { updateVehicle } from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    username: "sample-user",
    password: "hashed",
    email: "sample@example.com",
    name: "Sample User",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("vehicles.markAsReturned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should mark vehicle as returned and update pericia status to feita", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockReturnedVehicle = {
      id: 1,
      placaOriginal: "TEST1234",
      placaOstentada: null,
      marca: null,
      modelo: null,
      cor: null,
      ano: null,
      anoModelo: null,
      chassi: null,
      combustivel: null,
      municipio: null,
      uf: null,
      numeroProcedimento: "001-00001/2026",
      numeroProcesso: "0000001-00.2026.8.06.0001",
      observacoes: null,
      statusPericia: "feita" as const,
      devolvido: "sim" as const,
      dataDevolucao: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 1,
    };

    vi.mocked(updateVehicle).mockResolvedValue(mockReturnedVehicle);

    const result = await caller.vehicles.markAsReturned({ id: 1 });

    // Verify the result
    expect(result?.devolvido).toBe("sim");
    expect(result?.statusPericia).toBe("feita");
    expect(result?.dataDevolucao).toBeInstanceOf(Date);

    // Verify updateVehicle was called with correct parameters
    expect(updateVehicle).toHaveBeenCalledWith(1, {
      devolvido: "sim",
      dataDevolucao: expect.any(Date),
      statusPericia: "feita",
    });
  });

  it("should handle vehicle not found", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.mocked(updateVehicle).mockResolvedValue(null);

    const result = await caller.vehicles.markAsReturned({ id: 999 });

    expect(result).toBeNull();
  });
});
