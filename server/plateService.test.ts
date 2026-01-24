import { describe, expect, it, vi } from "vitest";
import { searchPlate, type PlateSearchResult } from "./plateService";

describe("plateService", () => {
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
      // Note: This test may fail if the API is unavailable
      // The important thing is that it doesn't reject the format
      const result = await searchPlate("ABC1234");
      
      // Either success or API error, but not format error
      if (!result.success) {
        expect(result.error).not.toContain("Formato de placa inválido");
      }
    });

    it("should accept valid Mercosul format plate (ABC1D23)", async () => {
      // Note: This test may fail if the API is unavailable
      const result = await searchPlate("ABC1D23");
      
      // Either success or API error, but not format error
      if (!result.success) {
        expect(result.error).not.toContain("Formato de placa inválido");
      }
    });

    it("should normalize plate by removing spaces and dashes", async () => {
      const result = await searchPlate("ABC-1234");
      
      // Should not fail due to format - the function normalizes the input
      if (!result.success) {
        expect(result.error).not.toContain("Formato de placa inválido");
      }
    });

    it("should convert plate to uppercase", async () => {
      const result = await searchPlate("abc1234");
      
      // Should not fail due to format - the function converts to uppercase
      if (!result.success) {
        expect(result.error).not.toContain("Formato de placa inválido");
      }
    });

    it("should return proper structure on success", async () => {
      // This is a structural test - we verify the return type
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
  });
});
