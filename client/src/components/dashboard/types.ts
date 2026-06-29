export type Vehicle = {
  id: number;
  placaOriginal: string | null;
  placaOstentada: string | null;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  ano: string | null;
  anoModelo: string | null;
  chassi: string | null;
  combustivel: string | null;
  municipio: string | null;
  uf: string | null;
  tipoProcedimento: "IP" | "TCO" | "BOC" | "BO" | null;
  numeroProcedimento: string | null;
  numeroProcesso: string | null;
  observacoes: string | null;
  statusPericia: "pendente" | "sem_pericia" | "feita";
  devolvido: "sim" | "nao";
  dataDevolucao: Date | null;
  fotos: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
};

export type SortField = "createdAt" | "placaOriginal" | "marca" | "statusPericia" | "devolvido";

export type VehicleFormData = {
  placaOriginal: string;
  placaOstentada: string;
  marca: string;
  modelo: string;
  cor: string;
  ano: string;
  anoModelo: string;
  chassi: string;
  combustivel: string;
  municipio: string;
  uf: string;
  tipoProcedimento: "IP" | "TCO" | "BOC" | "BO" | "";
  numeroProcedimento: string;
  numeroProcesso: string;
  observacoes: string;
  statusPericia: "pendente" | "sem_pericia" | "feita";
  devolvido: "sim" | "nao";
  fotos: string[];
};

/** Estado inicial/limpo do formulário de veículo. */
export function emptyFormData(): VehicleFormData {
  return {
    placaOriginal: "",
    placaOstentada: "",
    marca: "",
    modelo: "",
    cor: "",
    ano: "",
    anoModelo: "",
    chassi: "",
    combustivel: "",
    municipio: "",
    uf: "",
    tipoProcedimento: "",
    numeroProcedimento: "",
    numeroProcesso: "",
    observacoes: "",
    statusPericia: "pendente",
    devolvido: "nao",
    fotos: [],
  };
}

/** Garante que fotos seja sempre um array de strings, mesmo vindo como string JSON do banco */
export function parseFotos(fotos: unknown): string[] {
  if (Array.isArray(fotos)) return fotos;
  if (typeof fotos === "string") {
    try {
      const parsed = JSON.parse(fotos);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}
