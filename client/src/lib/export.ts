// Export utilities for vehicles data

export interface VehicleExportData {
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
  destinoDevolucao: "restituido" | "detran" | "dra" | "outros" | null;
  destinoDevolucaoDescricao: string | null;
  createdAt: Date;
}

const formatDate = (date: Date | null | string): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

/**
 * Neutraliza injeção de fórmula em CSV: prefixa com apóstrofo qualquer valor que
 * comece com =, +, -, @, TAB ou CR, evitando que o Excel/Sheets execute o
 * conteúdo como fórmula ao abrir o arquivo.
 */
const escapeSpreadsheetValue = (value: string): string =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

const formatPericia = (status: string): string => {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "feita":
      return "Feita";
    case "sem_pericia":
      return "Sem Perícia";
    default:
      return status;
  }
};

const DESTINO_LABELS: Record<string, string> = {
  restituido: "Restituído",
  detran: "Detran",
  dra: "DRA",
  outros: "Outros",
};

const formatDestino = (destino: string | null, descricao: string | null): string => {
  if (!destino) return "";
  const base = DESTINO_LABELS[destino] ?? destino;
  return destino === "outros" && descricao ? `${base}: ${descricao}` : base;
};

export const exportToCSV = (vehicles: VehicleExportData[], filename?: string): void => {
  if (!vehicles.length) {
    throw new Error("Nenhum veículo para exportar");
  }

  const headers = [
    "ID",
    "Placa Original",
    "Placa Ostentada",
    "Marca",
    "Modelo",
    "Cor",
    "Ano Fab.",
    "Ano Mod.",
    "Chassi",
    "Combustível",
    "Município",
    "UF",
    "Tipo Procedimento",
    "Procedimento",
    "Processo",
    "Observações",
    "Status Perícia",
    "Devolvido",
    "Data Devolução",
    "Destino",
    "Data Cadastro",
  ];

  const rows = vehicles.map((v) => [
    v.id.toString(),
    v.placaOriginal || "",
    v.placaOstentada || "",
    v.marca || "",
    v.modelo || "",
    v.cor || "",
    v.ano || "",
    v.anoModelo || "",
    v.chassi || "",
    v.combustivel || "",
    v.municipio || "",
    v.uf || "",
    v.tipoProcedimento || "",
    v.numeroProcedimento || "",
    v.numeroProcesso || "",
    v.observacoes || "",
    formatPericia(v.statusPericia),
    v.devolvido === "sim" ? "Sim" : "Não",
    formatDate(v.dataDevolucao),
    formatDestino(v.destinoDevolucao, v.destinoDevolucaoDescricao),
    formatDate(v.createdAt),
  ]);

  // Sanitiza contra injeção de fórmula e escapa aspas para a estrutura do CSV.
  const csvContent = [
    headers.join(";"),
    ...rows.map((r) =>
      r.map((cell) => `"${escapeSpreadsheetValue(cell).replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename || `veiculos_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToExcel = async (
  vehicles: VehicleExportData[],
  filename?: string
): Promise<void> => {
  if (!vehicles.length) {
    throw new Error("Nenhum veículo para exportar");
  }

  // Dynamically import exceljs library (substituiu xlsx vulnerável)
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Veículos");

  // Define headers
  const headers = [
    "ID",
    "Placa Original",
    "Placa Ostentada",
    "Marca",
    "Modelo",
    "Cor",
    "Ano Fab.",
    "Ano Mod.",
    "Chassi",
    "Combustível",
    "Município",
    "UF",
    "Tipo Procedimento",
    "Procedimento",
    "Processo",
    "Observações",
    "Status Perícia",
    "Devolvido",
    "Data Devolução",
    "Destino",
    "Data Cadastro",
  ];

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 2, 12),
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Add data rows
  vehicles.forEach((v) => {
    worksheet.addRow({
      ID: v.id,
      "Placa Original": v.placaOriginal || "",
      "Placa Ostentada": v.placaOstentada || "",
      Marca: v.marca || "",
      Modelo: v.modelo || "",
      Cor: v.cor || "",
      "Ano Fab.": v.ano || "",
      "Ano Mod.": v.anoModelo || "",
      Chassi: v.chassi || "",
      Combustível: v.combustivel || "",
      Município: v.municipio || "",
      UF: v.uf || "",
      "Tipo Procedimento": v.tipoProcedimento || "",
      Procedimento: v.numeroProcedimento || "",
      Processo: v.numeroProcesso || "",
      Observações: v.observacoes || "",
      "Status Perícia": formatPericia(v.statusPericia),
      Devolvido: v.devolvido === "sim" ? "Sim" : "Não",
      "Data Devolução": formatDate(v.dataDevolucao),
      Destino: formatDestino(v.destinoDevolucao, v.destinoDevolucaoDescricao),
      "Data Cadastro": formatDate(v.createdAt),
    });
  });

  // Defesa em profundidade: o ExcelJS grava strings como células de texto (não
  // como fórmulas), mas sanitizamos mesmo assim para consistência com o CSV.
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // pula o cabeçalho
    row.eachCell((cell) => {
      if (typeof cell.value === "string") {
        cell.value = escapeSpreadsheetValue(cell.value);
      }
    });
  });

  // Auto-fit column widths based on content
  worksheet.columns.forEach((column) => {
    let maxLength = column.header?.toString().length || 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value?.toString().length || 0;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  // Generate file and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download =
    filename || `veiculos_${new Date().toISOString().split("T")[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};
