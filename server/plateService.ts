/**
 * Serviço de consulta de placas veiculares usando API Placas
 * Documentação: https://apiplacas.com.br/doc.php
 */

import axios from "axios";
import { logger } from "./_core/logger";

export interface VehicleData {
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  ano: string | null;
  anoModelo: string | null;
  chassi: string | null;
  combustivel: string | null;
  municipio: string | null;
  uf: string | null;
  situacao: string | null;
}

export interface PlateSearchResult {
  success: boolean;
  data: VehicleData | null;
  error: string | null;
}

// Regex para validação de placas (antigo: ABC1234, Mercosul: ABC1D23)
const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/**
 * Consulta dados do veículo pela placa usando a API Placas
 * @param plate - Placa do veículo (formato antigo ABC1234 ou Mercosul ABC1D23)
 * @returns Dados do veículo ou erro
 */
export async function searchPlate(plate: string): Promise<PlateSearchResult> {
  // Normaliza a placa (remove espaços e traços, converte para maiúsculo)
  const normalizedPlate = plate.replace(/[-\s]/g, "").toUpperCase();

  // Valida formato da placa ANTES de verificar token (fail fast)
  if (!PLATE_REGEX.test(normalizedPlate)) {
    return {
      success: false,
      data: null,
      error: "Formato de placa inválido. Use o formato ABC1234 ou ABC1D23.",
    };
  }

  const token = process.env.API_PLACAS_TOKEN;

  if (!token) {
    logger.error("[PlateService]", "Token da API Placas não configurado");
    return {
      success: false,
      data: null,
      error:
        "Serviço de consulta não configurado. Entre em contato com o administrador.",
    };
  }

  try {
    // URL da API Placas (token nunca é logado)
    const apiUrl = `https://wdapi2.com.br/consulta/${normalizedPlate}/${token}`;

    logger.debug("[PlateService]", `Consultando placa ${normalizedPlate}...`);

    // Faz a requisição com timeout de 15 segundos
    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });

    const result = response.data;

    // Verifica se houve erro na resposta
    if (response.status !== 200) {
      logger.error("[PlateService]", `Erro na API: ${response.status}`);
      return {
        success: false,
        data: null,
        error: result.message || "Erro ao consultar a placa.",
      };
    }

    // Extrai os dados do veículo
    const vehicleData: VehicleData = {
      marca: result.MARCA || result.marca || null,
      modelo: result.MODELO || result.modelo || null,
      cor: result.cor || null,
      ano: result.ano || null,
      anoModelo: result.anoModelo || null,
      chassi: result.chassi || null,
      combustivel: result.extra?.combustivel || null,
      municipio: result.municipio || null,
      uf: result.uf || null,
      situacao: result.situacao || null,
    };

    logger.debug(
      "[PlateService]",
      `Consulta bem-sucedida para placa ${normalizedPlate}`
    );

    return {
      success: true,
      data: vehicleData,
      error: null,
    };
  } catch (error) {
    logger.error("[PlateService]", "Erro ao consultar placa");

    // Mensagens de erro amigáveis baseadas no código HTTP
    let errorMessage = "Erro ao consultar a placa. Tente novamente.";

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 400) {
        errorMessage = "URL incorreta. Entre em contato com o administrador.";
      } else if (status === 401) {
        errorMessage = message || "Placa inválida. Verifique o formato.";
      } else if (status === 402) {
        errorMessage =
          "Token inválido. Entre em contato com o administrador.";
      } else if (status === 406) {
        errorMessage = "Veículo não encontrado na base de dados.";
      } else if (status === 429) {
        errorMessage =
          "Limite de consultas atingido. Aguarde ou entre em contato com o administrador.";
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "A consulta demorou muito. Tente novamente.";
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        errorMessage =
          "Serviço temporariamente indisponível. Tente novamente mais tarde.";
      }
    }

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
}
