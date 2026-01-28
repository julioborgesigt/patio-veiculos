import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { searchPlate, type PlateSearchResult } from "./plateService";

// Mock axios
vi.mock("axios");

describe("plateService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, API_PLACAS_TOKEN: "test-token-123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("searchPlate", () => {
    it("should reject invalid plate format - too short", async () => {
      const result = await searchPlate("ABC12");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Formato de placa inválido");
      expect(result.data).toBeNull();
    });

    it("should reject invalid plate format - wrong pattern", async () => {
      const result = await searchPlate("12345AB");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Formato de placa inválido");
      expect(result.data).toBeNull();
    });

    it("should accept valid old format plate (ABC1234)", async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: {
          MARCA: "VOLKSWAGEN",
          MODELO: "GOL",
          cor: "PRATA",
          ano: "2020",
          anoModelo: "2021",
          chassi: "9BWAB05U91T123456",
          extra: { combustivel: "GASOLINA" },
          municipio: "SAO PAULO",
          uf: "SP",
          situacao: "REGULAR",
        },
      });

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.marca).toBe("VOLKSWAGEN");
      expect(result.data?.modelo).toBe("GOL");
    });

    it("should accept valid Mercosul format plate (ABC1D23)", async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: {
          MARCA: "FIAT",
          MODELO: "ARGO",
          cor: "BRANCO",
          ano: "2022",
        },
      });

      const result = await searchPlate("ABC1D23");

      expect(result.success).toBe(true);
      expect(result.data?.marca).toBe("FIAT");
    });

    it("should normalize plate by removing spaces and dashes", async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: { MARCA: "FORD", MODELO: "KA" },
      });

      const result = await searchPlate("ABC-1234");

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("ABC1234"),
        expect.any(Object)
      );
    });

    it("should convert plate to uppercase", async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: { MARCA: "HONDA", MODELO: "CIVIC" },
      });

      const result = await searchPlate("abc1234");

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("ABC1234"),
        expect.any(Object)
      );
    });

    it("should return proper structure on success", async () => {
      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: {
          MARCA: "TOYOTA",
          MODELO: "COROLLA",
          cor: "PRETO",
          ano: "2023",
          anoModelo: "2024",
          chassi: "9BR53ZEC5P0123456",
          extra: { combustivel: "FLEX" },
          municipio: "RIO DE JANEIRO",
          uf: "RJ",
          situacao: "REGULAR",
        },
      });

      const result: PlateSearchResult = await searchPlate("ABC1234");

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(typeof result.success).toBe("boolean");

      if (result.success && result.data) {
        expect(result.data).toHaveProperty("marca");
        expect(result.data).toHaveProperty("modelo");
        expect(result.data).toHaveProperty("cor");
        expect(result.data).toHaveProperty("ano");
        expect(result.data).toHaveProperty("anoModelo");
        expect(result.data).toHaveProperty("chassi");
        expect(result.data).toHaveProperty("combustivel");
        expect(result.data).toHaveProperty("municipio");
        expect(result.data).toHaveProperty("uf");
        expect(result.data).toHaveProperty("situacao");
      }
    });

    it("should return error when token is not configured", async () => {
      delete process.env.API_PLACAS_TOKEN;

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(false);
      expect(result.error).toContain("não configurado");
    });

    it("should handle API 406 error (vehicle not found)", async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 406, data: {} },
      };
      vi.mocked(axios.get).mockRejectedValue(axiosError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(false);
      expect(result.error).toContain("não encontrado");
    });

    it("should handle API 429 error (rate limit)", async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 429, data: {} },
      };
      vi.mocked(axios.get).mockRejectedValue(axiosError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Limite de consultas");
    });

    it("should handle API 402 error (invalid token)", async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 402, data: {} },
      };
      vi.mocked(axios.get).mockRejectedValue(axiosError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token inválido");
    });

    it("should handle timeout error", async () => {
      const axiosError = {
        isAxiosError: true,
        code: "ECONNABORTED",
        response: undefined,
      };
      vi.mocked(axios.get).mockRejectedValue(axiosError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const result = await searchPlate("ABC1234");

      expect(result.success).toBe(false);
      expect(result.error).toContain("demorou muito");
    });
  });
});
