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
}));

import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleById,
  listVehicles,
  getVehicleStats,
  getAllVehiclesForExport,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
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

describe("vehicles router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("vehicles.create", () => {
    it("creates a vehicle with valid data", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockVehicle = {
        id: 1,
        placaOriginal: "ABC-1234",
        placaOstentada: null,
        marca: "Volkswagen",
        modelo: "Gol",
        cor: "Prata",
        ano: "2020",
        chassi: null,
        numeroProcedimento: "001-00001/2024",
        numeroProcesso: null,
        observacoes: "Teste",
        statusPericia: "pendente" as const,
        devolvido: "nao" as const,
        dataDevolucao: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
      };

      vi.mocked(createVehicle).mockResolvedValue(mockVehicle);

      const result = await caller.vehicles.create({
        placaOriginal: "ABC-1234",
        marca: "Volkswagen",
        modelo: "Gol",
        cor: "Prata",
        ano: "2020",
        numeroProcedimento: "001-00001/2024",
        observacoes: "Teste",
        statusPericia: "pendente",
        devolvido: "nao",
      });

      expect(result).toEqual(mockVehicle);
      expect(createVehicle).toHaveBeenCalledWith(
        expect.objectContaining({
          placaOriginal: "ABC-1234",
          marca: "Volkswagen",
          createdBy: 1,
        })
      );
    });

    it("validates procedimento format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.vehicles.create({
          numeroProcedimento: "invalid-format",
          statusPericia: "pendente",
          devolvido: "nao",
        })
      ).rejects.toThrow();
    });

    it("validates processo format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.vehicles.create({
          numeroProcesso: "invalid-format",
          statusPericia: "pendente",
          devolvido: "nao",
        })
      ).rejects.toThrow();
    });

    it("accepts valid processo format", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockVehicle = {
        id: 1,
        placaOriginal: null,
        placaOstentada: null,
        marca: null,
        modelo: null,
        cor: null,
        ano: null,
        chassi: null,
        numeroProcedimento: null,
        numeroProcesso: "0000001-00.2024.8.26.0001",
        observacoes: null,
        statusPericia: "pendente" as const,
        devolvido: "nao" as const,
        dataDevolucao: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
      };

      vi.mocked(createVehicle).mockResolvedValue(mockVehicle);

      const result = await caller.vehicles.create({
        numeroProcesso: "0000001-00.2024.8.26.0001",
        statusPericia: "pendente",
        devolvido: "nao",
      });

      expect(result).toEqual(mockVehicle);
    });
  });

  describe("vehicles.list", () => {
    it("lists vehicles with pagination", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockResult = {
        vehicles: [
          {
            id: 1,
            placaOriginal: "ABC-1234",
            placaOstentada: null,
            marca: "Volkswagen",
            modelo: "Gol",
            cor: "Prata",
            ano: "2020",
            chassi: null,
            numeroProcedimento: null,
            numeroProcesso: null,
            observacoes: null,
            statusPericia: "pendente" as const,
            devolvido: "nao" as const,
            dataDevolucao: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 1,
          },
        ],
        total: 1,
      };

      vi.mocked(listVehicles).mockResolvedValue(mockResult);

      const result = await caller.vehicles.list({
        page: 1,
        pageSize: 10,
        sortOrder: "desc",
      });

      expect(result).toEqual(mockResult);
      expect(listVehicles).toHaveBeenCalledWith({
        filters: undefined,
        page: 1,
        pageSize: 10,
        sortBy: undefined,
        sortOrder: "desc",
      });
    });

    it("applies filters correctly", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      vi.mocked(listVehicles).mockResolvedValue({ vehicles: [], total: 0 });

      await caller.vehicles.list({
        filters: {
          search: "ABC",
          devolvido: "nao",
          statusPericia: "pendente",
        },
        page: 1,
        pageSize: 10,
        sortOrder: "desc",
      });

      expect(listVehicles).toHaveBeenCalledWith({
        filters: {
          search: "ABC",
          devolvido: "nao",
          statusPericia: "pendente",
        },
        page: 1,
        pageSize: 10,
        sortBy: undefined,
        sortOrder: "desc",
      });
    });
  });

  describe("vehicles.stats", () => {
    it("returns vehicle statistics", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockStats = {
        totalNoPatio: 10,
        totalDevolvidos: 5,
        periciasPendentes: 3,
        periciasFeitas: 7,
        semPericia: 5,
        totalGeral: 15,
      };

      vi.mocked(getVehicleStats).mockResolvedValue(mockStats);

      const result = await caller.vehicles.stats();

      expect(result).toEqual(mockStats);
    });
  });

  describe("vehicles.delete", () => {
    it("deletes a vehicle", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      vi.mocked(deleteVehicle).mockResolvedValue(true);

      const result = await caller.vehicles.delete({ id: 1 });

      expect(result).toEqual({ success: true });
      expect(deleteVehicle).toHaveBeenCalledWith(1);
    });
  });

  describe("vehicles.update", () => {
    it("updates a vehicle", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockVehicle = {
        id: 1,
        placaOriginal: "XYZ-5678",
        placaOstentada: null,
        marca: "Fiat",
        modelo: "Uno",
        cor: "Branco",
        ano: "2021",
        chassi: null,
        numeroProcedimento: null,
        numeroProcesso: null,
        observacoes: null,
        statusPericia: "feita" as const,
        devolvido: "nao" as const,
        dataDevolucao: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
      };

      vi.mocked(updateVehicle).mockResolvedValue(mockVehicle);

      const result = await caller.vehicles.update({
        id: 1,
        data: {
          placaOriginal: "XYZ-5678",
          marca: "Fiat",
          modelo: "Uno",
          statusPericia: "feita",
        },
      });

      expect(result).toEqual(mockVehicle);
    });
  });

  describe("vehicles.markAsReturned", () => {
    it("marks a vehicle as returned", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockVehicle = {
        id: 1,
        placaOriginal: "ABC-1234",
        placaOstentada: null,
        marca: "Volkswagen",
        modelo: "Gol",
        cor: "Prata",
        ano: "2020",
        chassi: null,
        numeroProcedimento: null,
        numeroProcesso: null,
        observacoes: null,
        statusPericia: "feita" as const,
        devolvido: "sim" as const,
        dataDevolucao: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
      };

      vi.mocked(updateVehicle).mockResolvedValue(mockVehicle);

      const result = await caller.vehicles.markAsReturned({ id: 1 });

      expect(result).toEqual(mockVehicle);
      expect(updateVehicle).toHaveBeenCalledWith(1, {
        devolvido: "sim",
        dataDevolucao: expect.any(Date),
        statusPericia: "feita",
      });
    });
  });

  describe("vehicles.updatePericiaStatus", () => {
    it("updates pericia status", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const mockVehicle = {
        id: 1,
        placaOriginal: "ABC-1234",
        placaOstentada: null,
        marca: "Volkswagen",
        modelo: "Gol",
        cor: "Prata",
        ano: "2020",
        chassi: null,
        numeroProcedimento: null,
        numeroProcesso: null,
        observacoes: null,
        statusPericia: "feita" as const,
        devolvido: "nao" as const,
        dataDevolucao: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 1,
      };

      vi.mocked(updateVehicle).mockResolvedValue(mockVehicle);

      const result = await caller.vehicles.updatePericiaStatus({
        id: 1,
        status: "feita",
      });

      expect(result).toEqual(mockVehicle);
      expect(updateVehicle).toHaveBeenCalledWith(1, {
        statusPericia: "feita",
      });
    });
  });
});
