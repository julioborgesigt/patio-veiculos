import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleById,
  isDuplicateKeyError,
  createAuditLog,
  listAuditLogs,
  getAuditLogById,
  markAuditLogReverted,
} from "../db";
import { deleteS3ObjectByUrl } from "../_core/storage";

// Helper para extrair dados de veículo de previousData (JSON) com validação
function parseVehicleData(data: unknown): {
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
  fotos: string[] | null;
  createdBy: number | null;
} {
  if (!data || typeof data !== "object") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dados anteriores inválidos" });
  }
  const prev = data as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  const validPericia = ["pendente", "sem_pericia", "feita"] as const;
  const validDevolvido = ["sim", "nao"] as const;
  const validTipoProcedimento = ["IP", "TCO", "BOC", "BO"] as const;
  const validDestino = ["restituido", "detran", "dra", "outros"] as const;

  const statusPericia = validPericia.includes(prev.statusPericia as typeof validPericia[number])
    ? (prev.statusPericia as typeof validPericia[number])
    : "pendente";
  const devolvido = validDevolvido.includes(prev.devolvido as typeof validDevolvido[number])
    ? (prev.devolvido as typeof validDevolvido[number])
    : "nao";
  const tipoProcedimento = validTipoProcedimento.includes(prev.tipoProcedimento as typeof validTipoProcedimento[number])
    ? (prev.tipoProcedimento as typeof validTipoProcedimento[number])
    : null;
  const destinoDevolucao = validDestino.includes(prev.destinoDevolucao as typeof validDestino[number])
    ? (prev.destinoDevolucao as typeof validDestino[number])
    : null;

  let dataDevolucao: Date | null = null;
  if (prev.dataDevolucao) {
    const parsed = new Date(prev.dataDevolucao as string);
    if (!isNaN(parsed.getTime())) {
      dataDevolucao = parsed;
    }
  }

  // fotos pode vir como array (json) ou string JSON, dependendo do driver.
  let fotos: string[] | null = null;
  const rawFotos = prev.fotos;
  if (Array.isArray(rawFotos)) {
    fotos = rawFotos.filter((f): f is string => typeof f === "string");
  } else if (typeof rawFotos === "string") {
    try {
      const parsed = JSON.parse(rawFotos);
      if (Array.isArray(parsed)) {
        fotos = parsed.filter((f): f is string => typeof f === "string");
      }
    } catch {
      // ignore
    }
  }

  return {
    placaOriginal: str(prev.placaOriginal),
    placaOstentada: str(prev.placaOstentada),
    marca: str(prev.marca),
    modelo: str(prev.modelo),
    cor: str(prev.cor),
    ano: str(prev.ano),
    anoModelo: str(prev.anoModelo),
    chassi: str(prev.chassi),
    combustivel: str(prev.combustivel),
    municipio: str(prev.municipio),
    uf: str(prev.uf),
    tipoProcedimento,
    numeroProcedimento: str(prev.numeroProcedimento),
    numeroProcesso: str(prev.numeroProcesso),
    observacoes: str(prev.observacoes),
    statusPericia,
    devolvido,
    dataDevolucao,
    destinoDevolucao,
    destinoDevolucaoDescricao: str(prev.destinoDevolucaoDescricao),
    fotos,
    createdBy: typeof prev.createdBy === "number" ? prev.createdBy : null,
  };
}

export const auditLogsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        filters: z.object({
          action: z.string().optional(),
          username: z.string().optional(),
          entityId: z.number().optional(),
        }).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return listAuditLogs({
        filters: input.filters,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  // Reverter uma ação. Aberto a todos os usuários autenticados (política do
  // sistema: todos podem editar/excluir e a própria reversão fica registrada
  // no log de auditoria).
  revert: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const log = await getAuditLogById(input.id);
      if (!log) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Log não encontrado" });
      }
      if (log.reverted === "sim") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação já foi revertida" });
      }

      // Apenas ações sobre veículos podem ser revertidas
      if (log.entityType !== "vehicle" || !log.entityId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação não pode ser revertida" });
      }

      // Limpa do storage as fotos que deixaram de ser referenciadas (em background)
      const cleanupPhotos = (urls: string[]) => {
        for (const url of urls) deleteS3ObjectByUrl(url).catch(() => {});
      };

      // entityId afetado pela reversão (pode mudar ao recriar um veículo excluído)
      let revertedEntityId = log.entityId;

      switch (log.action) {
        case "criar_veiculo": {
          // Reverter criação = excluir o veículo e limpar suas fotos do storage
          const current = await getVehicleById(log.entityId);
          await deleteVehicle(log.entityId);
          if (current) cleanupPhotos(parseVehicleData(current).fotos ?? []);
          break;
        }
        case "editar_veiculo":
        case "marcar_pericia":
        case "reverter_pericia":
        case "marcar_devolvido":
        case "desfazer_devolucao": {
          // Reverter = restaurar dados anteriores (incluindo fotos)
          if (!log.previousData) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Não há dados anteriores para restaurar" });
          }
          const prev = parseVehicleData(log.previousData);
          const current = await getVehicleById(log.entityId);
          try {
            await updateVehicle(log.entityId, {
              placaOriginal: prev.placaOriginal,
              placaOstentada: prev.placaOstentada,
              marca: prev.marca,
              modelo: prev.modelo,
              cor: prev.cor,
              ano: prev.ano,
              anoModelo: prev.anoModelo,
              chassi: prev.chassi,
              combustivel: prev.combustivel,
              municipio: prev.municipio,
              uf: prev.uf,
              tipoProcedimento: prev.tipoProcedimento,
              numeroProcedimento: prev.numeroProcedimento,
              numeroProcesso: prev.numeroProcesso,
              observacoes: prev.observacoes,
              statusPericia: prev.statusPericia,
              devolvido: prev.devolvido,
              dataDevolucao: prev.dataDevolucao,
              destinoDevolucao: prev.destinoDevolucao,
              destinoDevolucaoDescricao: prev.destinoDevolucaoDescricao,
              fotos: prev.fotos,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Não foi possível reverter: a placa original já pertence a outro veículo.",
              });
            }
            throw err;
          }
          // Remove do storage fotos que existiam mas não fazem parte do estado restaurado
          if (current) {
            const restored = new Set(prev.fotos ?? []);
            cleanupPhotos((parseVehicleData(current).fotos ?? []).filter((u) => !restored.has(u)));
          }
          break;
        }
        case "excluir_veiculo": {
          // Reverter exclusão = recriar o veículo com os dados anteriores.
          // As fotos foram removidas do storage na exclusão e não podem ser
          // recuperadas, então o veículo é recriado sem fotos.
          if (!log.previousData) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Não há dados anteriores para restaurar" });
          }
          const prev = parseVehicleData(log.previousData);
          let recreated;
          try {
            recreated = await createVehicle({
              placaOriginal: prev.placaOriginal,
              placaOstentada: prev.placaOstentada,
              marca: prev.marca,
              modelo: prev.modelo,
              cor: prev.cor,
              ano: prev.ano,
              anoModelo: prev.anoModelo,
              chassi: prev.chassi,
              combustivel: prev.combustivel,
              municipio: prev.municipio,
              uf: prev.uf,
              tipoProcedimento: prev.tipoProcedimento,
              numeroProcedimento: prev.numeroProcedimento,
              numeroProcesso: prev.numeroProcesso,
              observacoes: prev.observacoes,
              statusPericia: prev.statusPericia,
              devolvido: prev.devolvido,
              dataDevolucao: prev.dataDevolucao,
              destinoDevolucao: prev.destinoDevolucao,
              destinoDevolucaoDescricao: prev.destinoDevolucaoDescricao,
              fotos: null,
              createdBy: prev.createdBy,
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Não foi possível reverter: a placa original já pertence a outro veículo.",
              });
            }
            throw err;
          }
          if (recreated) revertedEntityId = recreated.id;
          break;
        }
        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação não pode ser revertida" });
      }

      await markAuditLogReverted(log.id, ctx.user.id);

      // Registrar a reversão como nova ação
      await createAuditLog({
        userId: ctx.user.id,
        username: ctx.user.username,
        action: log.action,
        entityType: "vehicle",
        entityId: revertedEntityId,
        description: `Reverteu ação: ${log.description}`,
      });

      return { success: true };
    }),
});
