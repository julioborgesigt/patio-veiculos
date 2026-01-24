/**
 * Serviço de consulta de placas veiculares usando sinesp-api (experimental)
 * Esta API é gratuita mas pode ser instável. Em caso de falha, o usuário
 * deve preencher os dados manualmente.
 */

// @ts-ignore - sinesp-api não tem tipos TypeScript
import sinespApi from 'sinesp-api';

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

/**
 * Consulta dados do veículo pela placa usando a API SINESP (experimental)
 * @param plate - Placa do veículo (formato antigo ABC1234 ou Mercosul ABC1D23)
 * @returns Dados do veículo ou erro
 */
export async function searchPlate(plate: string): Promise<PlateSearchResult> {
  // Normaliza a placa (remove espaços e traços, converte para maiúsculo)
  const normalizedPlate = plate.replace(/[-\s]/g, '').toUpperCase();
  
  // Valida formato da placa (antigo: ABC1234, Mercosul: ABC1D23)
  const plateRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  if (!plateRegex.test(normalizedPlate)) {
    return {
      success: false,
      data: null,
      error: 'Formato de placa inválido. Use o formato ABC1234 ou ABC1D23.',
    };
  }

  try {
    // Configura timeout para evitar espera infinita
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tempo limite excedido')), 15000);
    });

    // Faz a consulta com timeout
    const searchPromise = sinespApi.search(normalizedPlate);
    const result = await Promise.race([searchPromise, timeoutPromise]);

    // Verifica se houve erro na resposta
    if (!result || result.codigoRetorno !== '0') {
      const errorMsg = result?.mensagemRetorno || 'Veículo não encontrado na base de dados';
      return {
        success: false,
        data: null,
        error: errorMsg,
      };
    }

    // Extrai os dados do veículo
    const vehicleData: VehicleData = {
      marca: result.marca || null,
      modelo: result.modelo || null,
      cor: result.cor || null,
      ano: result.ano || null,
      anoModelo: result.anoModelo || null,
      chassi: result.chassi || null,
      combustivel: result.extra?.combustivel || null,
      municipio: result.municipio || null,
      uf: result.uf || null,
      situacao: result.situacao || null,
    };

    return {
      success: true,
      data: vehicleData,
      error: null,
    };
  } catch (error) {
    console.error('[PlateService] Erro ao consultar placa:', error);
    
    // Mensagens de erro amigáveis
    let errorMessage = 'Erro ao consultar a placa. A API pode estar temporariamente indisponível.';
    
    if (error instanceof Error) {
      if (error.message.includes('Tempo limite')) {
        errorMessage = 'A consulta demorou muito. Tente novamente ou preencha os dados manualmente.';
      } else if (error.message.includes('LIMITE')) {
        errorMessage = 'Limite de consultas atingido. Por favor, preencha os dados manualmente.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Serviço temporariamente indisponível. Por favor, preencha os dados manualmente.';
      }
    }

    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
}
