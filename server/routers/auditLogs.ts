import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
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
  withTransaction,
} from "../db";
import { deleteS3ObjectByUrl } from "../_core/storage";
import { logger } from "../_core/logger";

// Coerce any value to string | null (accepts only actual strings)
const nstr = z.preprocess(
  v => (typeof v === "string" ? v : null),
  z.string().nullable()
);

// fotos pode vir como array (json) ou string JSON serializada, dependendo do driver MySQL.
const fotosSchema = z.preprocess(
  v => {
    if (Array.isArray(v)) return (v as unknown[]).filter(f => typeof f === "string");
    if (typeof v === "string") {
      try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p.filter((f: unknown) => typeof f === "string") : null;
      } catch { return null; }
    }
    return null;
  },
  z.array(z.string()).nullable()
);

// Schema Zod para deserializar previousData/newData de audit_logs.
// Cada campo usa preprocess para absorver tipos inesperados com segurança;
// mudanças no schema de veículos devem ser refletidas aqui.
const vehiclePreviousDataSchema = z.object({
  placaOriginal: nstr,
  placaOstentada: nstr,
  marca: nstr,
  modelo: nstr,
  cor: nstr,
  ano: nstr,
  anoModelo: nstr,
  chassi: nstr,
  combustivel: nstr,
  municipio: nstr,
  uf: nstr,
  tipoVeiculo: z.preprocess(
    v => (["carro", "moto", "outros"].includes(v as string) ? v : null),
    z.enum(["carro", "moto", "outros"]).nullable()
  ),
  tipoProcedimento: z.preprocess(
    v => (["IP", "TCO", "BOC", "BO"].includes(v as string) ? v : null),
    z.enum(["IP", "TCO", "BOC", "BO"]).nullable()
  ),
  numeroProcedimento: nstr,
  numeroProcesso: nstr,
  observacoes: nstr,
  statusPericia: z.preprocess(
    v => (["pendente", "sem_pericia", "feita"].includes(v as string) ? v : "pendente"),
    z.enum(["pendente", "sem_pericia", "feita"])
  ),
  devolvido: z.preprocess(
    v => (["sim", "nao"].includes(v as string) ? v : "nao"),
    z.enum(["sim", "nao"])
  ),
  dataDevolucao: z.preprocess(
    v => {
      if (!v) return null;
      if (v instanceof Date) return v;
      const d = new Date(v as string);
      return isNaN(d.getTime()) ? null : d;
    },
    z.date().nullable()
  ),
  destinoDevolucao: z.preprocess(
    v => (["restituido", "detran", "dra", "outros"].includes(v as string) ? v : null),
    z.enum(["restituido", "detran", "dra", "outros"]).nullable()
  ),
  destinoDevolucaoDescricao: nstr,
  fotos: fotosSchema,
  createdBy: z.preprocess(
    v => (typeof v === "number" ? v : null),
    z.number().nullable()
  ),
}).passthrough();

type VehiclePreviousData = z.infer<typeof vehiclePreviousDataSchema>;

function parseVehicleData(data: unknown): VehiclePreviousData {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dados anteriores inválidos" });
  }
  const result = vehiclePreviousDataSchema.safeParse(data);
  if (!result.success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dados anteriores inválidos" });
  }
  return result.data;
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

  // Reverter uma ação — restrito a admins (operação destrutiva e irreversível).
  revert: adminProcedure
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

      // Captura em const para o tipo se manter `number` dentro do closure da transação.
      const entityId = log.entityId;

      // Fotos que deixam de ser referenciadas — removidas do storage somente APÓS
      // o commit (não apaga nada se a reversão falhar e sofrer rollback).
      const photosToDelete: string[] = [];
      const cleanupPhotos = (urls: string[]) => {
        photosToDelete.push(...urls);
      };

      await withTransaction(async () => {
        // entityId afetado pela reversão (pode mudar ao recriar um veículo excluído)
        let revertedEntityId = entityId;

        switch (log.action) {
          case "criar_veiculo": {
            // Reverter criação = excluir o veículo e limpar suas fotos do storage
            const current = await getVehicleById(entityId);
            await deleteVehicle(entityId);
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
            const current = await getVehicleById(entityId);
            try {
              await updateVehicle(entityId, {
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

        // Registrar a reversão como ação própria de auditoria
        await createAuditLog({
          userId: ctx.user.id,
          username: ctx.user.username,
          action: "reverter",
          entityType: "vehicle",
          entityId: revertedEntityId,
          description: `Reverteu ação: ${log.description}`,
        });
      });

      // Limpeza do storage após o commit da transação (fire-and-forget)
      for (const url of photosToDelete) {
        deleteS3ObjectByUrl(url).catch((err) => {
          logger.warn("[Storage]", `Failed to delete photo ${url} after revert:`, err);
        });
      }

      return { success: true };
    }),
});
