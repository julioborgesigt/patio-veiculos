import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleById,
  listVehicles,
  getVehicleStats,
  getAllVehiclesForExport,
  findVehicleByPlaca,
  isDuplicateKeyError,
  createAuditLog,
  withTransaction,
} from "../db";
import { searchPlate } from "../plateService";
import { generatePresignedUploadUrl, getS3PublicUrl, deleteS3ObjectByUrl, isS3Configured, isStorageUrl, validateUploadedPhoto } from "../_core/storage";
import { logger } from "../_core/logger";
import { nanoid } from "nanoid";

// Validates all foto URLs are confirmed images in storage before persisting.
async function assertFotosAreImages(fotos: string[] | null | undefined): Promise<void> {
  if (!fotos?.length) return;
  for (const url of fotos) {
    const result = await validateUploadedPhoto(url);
    if (!result.valid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Foto inválida ou não encontrada no storage: ${result.reason ?? url}`,
      });
    }
  }
}

// Helper para descrever veículo nos logs
function describeVehicle(v: { placaOriginal?: string | null; marca?: string | null; modelo?: string | null }): string {
  const placa = v.placaOriginal || "sem placa";
  const desc = [v.marca, v.modelo].filter(Boolean).join(" ") || "veículo";
  return `${placa} (${desc})`;
}

// Destino do veículo quando devolvido
const destinoDevolucaoEnum = z.enum(["restituido", "detran", "dra", "outros"]);
type DestinoDevolucao = z.infer<typeof destinoDevolucaoEnum>;

const DESTINO_LABELS: Record<DestinoDevolucao, string> = {
  restituido: "Restituído",
  detran: "Detran",
  dra: "DRA",
  outros: "Outros",
};

// Exige destino quando o veículo é marcado como devolvido; descrição quando "outros".
function assertDestino(
  devolvido: "sim" | "nao" | undefined,
  destino: DestinoDevolucao | null | undefined,
  descricao: string | null | undefined
): void {
  if (devolvido !== "sim") return;
  if (!destino) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o destino do veículo devolvido." });
  }
  if (destino === "outros" && !descricao?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: 'Descreva o destino quando selecionar "Outros".' });
  }
}

// Normaliza os campos de destino: limpa quando não devolvido e descarta a
// descrição quando o destino não é "outros".
function normalizeDestino(
  devolvido: "sim" | "nao" | undefined,
  destino: DestinoDevolucao | null | undefined,
  descricao: string | null | undefined
): { destinoDevolucao: DestinoDevolucao | null; destinoDevolucaoDescricao: string | null } {
  if (devolvido !== "sim" || !destino) {
    return { destinoDevolucao: null, destinoDevolucaoDescricao: null };
  }
  return {
    destinoDevolucao: destino,
    destinoDevolucaoDescricao: destino === "outros" ? descricao?.trim() || null : null,
  };
}

// Regex para validação de formatos
// Procedimento: xxx-xxxxx/ano (ex: 001-00001/2024)
const procedimentoRegex = /^\d{3}-\d{5}\/\d{4}$/;
// Processo: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)
const processoRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

// Schema de validação para veículo
const vehicleInputSchema = z.object({
  placaOriginal: z.string().max(10).optional().nullable(),
  placaOstentada: z.string().max(10).optional().nullable(),
  marca: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
  cor: z.string().max(50).optional().nullable(),
  ano: z.string().max(10).optional().nullable(),
  anoModelo: z.string().max(10).optional().nullable(),
  chassi: z.string().max(50).optional().nullable(),
  combustivel: z.string().max(50).optional().nullable(),
  municipio: z.string().max(100).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  tipoProcedimento: z.enum(["IP", "TCO", "BOC", "BO"]).optional().nullable(),
  numeroProcedimento: z
    .string()
    .max(20)
    .optional()
    .nullable()
    .refine(
      (val) => !val || procedimentoRegex.test(val),
      { message: "Formato inválido. Use: xxx-xxxxx/ano (ex: 001-00001/2024)" }
    ),
  numeroProcesso: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .refine(
      (val) => !val || processoRegex.test(val),
      { message: "Formato inválido. Use: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)" }
    ),
  observacoes: z.string().max(200).optional().nullable(),
  statusPericia: z.enum(["pendente", "sem_pericia", "feita"]).default("pendente"),
  devolvido: z.enum(["sim", "nao"]).default("nao"),
  dataDevolucao: z.date().optional().nullable(),
  destinoDevolucao: destinoDevolucaoEnum.optional().nullable(),
  destinoDevolucaoDescricao: z.string().max(50).optional().nullable(),
  fotos: z
    .array(
      z
        .string()
        .url()
        .refine(isStorageUrl, {
          message: "URL de foto inválida (fora do storage configurado)",
        })
    )
    .max(2)
    .optional()
    .nullable(),
});

const filtersSchema = z.object({
  search: z.string().optional(),
  statusPericia: z.enum(["pendente", "sem_pericia", "feita"]).optional(),
  devolvido: z.enum(["sim", "nao"]).optional(),
  dataInicio: z.date().optional(),
  dataFim: z.date().optional(),
  dataDevolucaoInicio: z.date().optional(),
  dataDevolucaoFim: z.date().optional(),
});

// Campos válidos para ordenação
const VALID_SORT_FIELDS = [
  "id",
  "placaOriginal",
  "placaOstentada",
  "marca",
  "modelo",
  "cor",
  "ano",
  "anoModelo",
  "chassi",
  "municipio",
  "uf",
  "numeroProcedimento",
  "numeroProcesso",
  "statusPericia",
  "devolvido",
  "dataDevolucao",
  "createdAt",
  "updatedAt",
] as const;

const listParamsSchema = z.object({
  filters: filtersSchema.optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sortBy: z.enum(VALID_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const vehiclesRouter = router({
  // Criar veículo
  create: protectedProcedure
    .input(vehicleInputSchema)
    .mutation(async ({ input, ctx }) => {
      assertDestino(input.devolvido, input.destinoDevolucao, input.destinoDevolucaoDescricao);
      await assertFotosAreImages(input.fotos);

      if (input.placaOriginal) {
        const existing = await findVehicleByPlaca(input.placaOriginal);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um veículo cadastrado com a placa original ${input.placaOriginal}`,
          });
        }
      }
      let vehicle: Awaited<ReturnType<typeof createVehicle>>;
      try {
        // Veículo + log de auditoria gravados atomicamente (rollback se falhar).
        vehicle = await withTransaction(async () => {
          const created = await createVehicle({
            ...input,
            ...normalizeDestino(input.devolvido, input.destinoDevolucao, input.destinoDevolucaoDescricao),
            createdBy: ctx.user.id,
          });
          if (created) {
            await createAuditLog({
              userId: ctx.user.id,
              username: ctx.user.username,
              action: "criar_veiculo",
              entityType: "vehicle",
              entityId: created.id,
              description: `Cadastrou veículo ${describeVehicle(created)}`,
              newData: created,
            });
          }
          return created;
        });
      } catch (err) {
        // Corrida: a placa pode ter sido inserida por outra requisição entre
        // a checagem acima e o insert. O índice UNIQUE garante a integridade.
        if (isDuplicateKeyError(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um veículo cadastrado com a placa original ${input.placaOriginal}`,
          });
        }
        throw err;
      }

      return vehicle;
    }),

  // Atualizar veículo
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: vehicleInputSchema.partial(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertDestino(input.data.devolvido, input.data.destinoDevolucao, input.data.destinoDevolucaoDescricao);
      await assertFotosAreImages(input.data.fotos);

      if (input.data.placaOriginal) {
        const existing = await findVehicleByPlaca(input.data.placaOriginal, input.id);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um veículo cadastrado com a placa original ${input.data.placaOriginal}`,
          });
        }
      }

      // Quando o status de devolução é alterado, normaliza os campos de destino junto.
      const dataToUpdate =
        input.data.devolvido !== undefined
          ? { ...input.data, ...normalizeDestino(input.data.devolvido, input.data.destinoDevolucao, input.data.destinoDevolucaoDescricao) }
          : input.data;

      let vehicle: Awaited<ReturnType<typeof updateVehicle>>;
      try {
        vehicle = await withTransaction(async () => {
          const previous = await getVehicleById(input.id);
          const updated = await updateVehicle(input.id, dataToUpdate);
          if (updated && previous) {
            await createAuditLog({
              userId: ctx.user.id,
              username: ctx.user.username,
              action: "editar_veiculo",
              entityType: "vehicle",
              entityId: updated.id,
              description: `Editou veículo ${describeVehicle(updated)}`,
              previousData: previous,
              newData: updated,
            });
          }
          return updated;
        });
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um veículo cadastrado com a placa original ${input.data.placaOriginal}`,
          });
        }
        throw err;
      }

      return vehicle;
    }),

  // Deletar veículo — restrito a admins (ação irreversível via UI)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const previous = await getVehicleById(input.id);
      const success = await withTransaction(async () => {
        const ok = await deleteVehicle(input.id);
        if (ok && previous) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "excluir_veiculo",
            entityType: "vehicle",
            entityId: input.id,
            description: `Excluiu veículo ${describeVehicle(previous)}`,
            previousData: previous,
          });
        }
        return ok;
      });

      if (success && previous) {
        // Limpar fotos do S3 após o commit (falhas não bloqueiam a exclusão)
        const fotos = previous.fotos;
        const fotosArray: string[] = Array.isArray(fotos)
          ? fotos
          : typeof fotos === "string"
            ? (() => { try { const p = JSON.parse(fotos); return Array.isArray(p) ? p : []; } catch { return []; } })()
            : [];
        for (const url of fotosArray) {
          deleteS3ObjectByUrl(url).catch((err) => {
            logger.warn("[Storage]", `Failed to delete photo ${url}:`, err);
          });
        }
      }

      return { success };
    }),

  // Buscar veículo por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const vehicle = await getVehicleById(input.id);
      return vehicle;
    }),

  // Listar veículos com filtros e paginação
  list: protectedProcedure
    .input(listParamsSchema)
    .query(async ({ input }) => {
      const result = await listVehicles({
        filters: input.filters,
        page: input.page,
        pageSize: input.pageSize,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      });
      return result;
    }),

  // Estatísticas do dashboard
  stats: protectedProcedure.query(async () => {
    const stats = await getVehicleStats();
    return stats;
  }),

  // Exportar todos os veículos (para CSV/Excel) — restrito a admins (acesso bulk a dados)
  export: adminProcedure
    .input(filtersSchema.optional())
    .query(async ({ input }) => {
      const vehicles = await getAllVehiclesForExport(input);
      return vehicles;
    }),

  // Marcar como devolvido (atualiza status e perícia automaticamente)
  markAsReturned: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        destinoDevolucao: destinoDevolucaoEnum,
        destinoDevolucaoDescricao: z.string().max(50).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertDestino("sim", input.destinoDevolucao, input.destinoDevolucaoDescricao);
      const { destinoDevolucao, destinoDevolucaoDescricao } = normalizeDestino(
        "sim",
        input.destinoDevolucao,
        input.destinoDevolucaoDescricao
      );

      return withTransaction(async () => {
        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, {
          devolvido: "sim",
          dataDevolucao: new Date(),
          statusPericia: "feita",
          destinoDevolucao,
          destinoDevolucaoDescricao,
        });

        if (vehicle && previous) {
          const destinoTexto = destinoDevolucaoDescricao
            ? `${DESTINO_LABELS[input.destinoDevolucao]}: ${destinoDevolucaoDescricao}`
            : DESTINO_LABELS[input.destinoDevolucao];
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "marcar_devolvido",
            entityType: "vehicle",
            entityId: vehicle.id,
            description: `Marcou veículo ${describeVehicle(vehicle)} como devolvido (${destinoTexto})`,
            previousData: previous,
            newData: vehicle,
          });
        }

        return vehicle;
      });
    }),

  // Desfazer devolução (volta para "no pátio")
  undoReturn: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return withTransaction(async () => {
        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, {
          devolvido: "nao",
          dataDevolucao: null,
          destinoDevolucao: null,
          destinoDevolucaoDescricao: null,
        });

        if (vehicle && previous) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "desfazer_devolucao",
            entityType: "vehicle",
            entityId: vehicle.id,
            description: `Desfez devolução do veículo ${describeVehicle(vehicle)}`,
            previousData: previous,
            newData: vehicle,
          });
        }

        return vehicle;
      });
    }),

  // Atualizar status de perícia
  updatePericiaStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pendente", "sem_pericia", "feita"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return withTransaction(async () => {
        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, {
          statusPericia: input.status,
        });

        if (vehicle && previous) {
          const action = input.status === "pendente" ? "reverter_pericia" : "marcar_pericia";
          const actionDesc = input.status === "pendente"
            ? `Reverteu perícia do veículo ${describeVehicle(vehicle)} para pendente`
            : `Marcou perícia do veículo ${describeVehicle(vehicle)} como ${input.status === "feita" ? "feita" : "sem perícia"}`;

          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action,
            entityType: "vehicle",
            entityId: vehicle.id,
            description: actionDesc,
            previousData: previous,
            newData: vehicle,
          });
        }

        return vehicle;
      });
    }),

  // Consultar placa na API externa (experimental)
  searchPlate: protectedProcedure
    .input(z.object({ plate: z.string().min(7).max(8) }))
    .query(async ({ input }) => {
      const result = await searchPlate(input.plate);
      return result;
    }),

  // Gerar presigned URL para upload de foto ao S3
  getUploadUrl: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!isS3Configured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Upload de fotos não configurado. Configure AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no servidor.",
        });
      }

      const key = `vehicles/${ctx.user.id}/${Date.now()}-${nanoid(8)}.jpg`;
      const presignedUrl = await generatePresignedUploadUrl(key);
      const publicUrl = getS3PublicUrl(key);

      return { presignedUrl, publicUrl };
    }),

  // Deletar foto órfã do S3 (ex: upload feito mas cadastro cancelado).
  // Só permite apagar objetos sob o prefixo do próprio usuário (evita IDOR).
  deletePhoto: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      await deleteS3ObjectByUrl(input.url, { keyPrefix: `vehicles/${ctx.user.id}/` });
      return { success: true };
    }),
});
