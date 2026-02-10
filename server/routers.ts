import { COOKIE_NAME, THIRTY_DAYS_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getVehicleById,
  listVehicles,
  getVehicleStats,
  getAllVehiclesForExport,
  getUserByUsername,
  verifyPassword,
  updateLastSignedIn,
  findVehicleByPlaca,
  createAuditLog,
  listAuditLogs,
  getAuditLogById,
  markAuditLogReverted,
} from "./db";
import { searchPlate } from "./plateService";

// Helper para descrever veículo nos logs
function describeVehicle(v: { placaOriginal?: string | null; marca?: string | null; modelo?: string | null }): string {
  const placa = v.placaOriginal || "sem placa";
  const desc = [v.marca, v.modelo].filter(Boolean).join(" ") || "veículo";
  return `${placa} (${desc})`;
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

type ValidSortField = (typeof VALID_SORT_FIELDS)[number];

const listParamsSchema = z.object({
  filters: filtersSchema.optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sortBy: z.enum(VALID_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => {
      return opts.ctx.user;
    }),
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByUsername(input.username);

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário ou senha inválidos",
          });
        }

        const passwordValid = verifyPassword(input.password, user.password);

        if (!passwordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário ou senha inválidos",
          });
        }

        await updateLastSignedIn(user.id);

        const sessionToken = await sdk.createSessionToken(
          { id: user.id, username: user.username, role: user.role },
          { expiresInMs: THIRTY_DAYS_MS }
        );

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });

        // Log de login
        await createAuditLog({
          userId: user.id,
          username: user.username,
          action: "login",
          entityType: "user",
          entityId: user.id,
          description: `${user.username} fez login no sistema`,
        });

        return {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  vehicles: router({
    // Criar veículo
    create: protectedProcedure
      .input(vehicleInputSchema)
      .mutation(async ({ input, ctx }) => {
        if (input.placaOriginal) {
          const existing = await findVehicleByPlaca(input.placaOriginal);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Já existe um veículo cadastrado com a placa original ${input.placaOriginal}`,
            });
          }
        }
        const vehicle = await createVehicle({
          ...input,
          createdBy: ctx.user.id,
        });

        if (vehicle) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "criar_veiculo",
            entityType: "vehicle",
            entityId: vehicle.id,
            description: `Cadastrou veículo ${describeVehicle(vehicle)}`,
            newData: vehicle,
          });
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
        if (input.data.placaOriginal) {
          const existing = await findVehicleByPlaca(input.data.placaOriginal, input.id);
          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Já existe um veículo cadastrado com a placa original ${input.data.placaOriginal}`,
            });
          }
        }

        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, input.data);

        if (vehicle && previous) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "editar_veiculo",
            entityType: "vehicle",
            entityId: vehicle.id,
            description: `Editou veículo ${describeVehicle(vehicle)}`,
            previousData: previous,
            newData: vehicle,
          });
        }

        return vehicle;
      }),

    // Deletar veículo
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const previous = await getVehicleById(input.id);
        const success = await deleteVehicle(input.id);

        if (success && previous) {
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

    // Exportar todos os veículos (para CSV/Excel)
    export: protectedProcedure
      .input(filtersSchema.optional())
      .query(async ({ input }) => {
        const vehicles = await getAllVehiclesForExport(input);
        return vehicles;
      }),

    // Marcar como devolvido (atualiza status e perícia automaticamente)
    markAsReturned: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, {
          devolvido: "sim",
          dataDevolucao: new Date(),
          statusPericia: "feita",
        });

        if (vehicle && previous) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "marcar_devolvido",
            entityType: "vehicle",
            entityId: vehicle.id,
            description: `Marcou veículo ${describeVehicle(vehicle)} como devolvido`,
            previousData: previous,
            newData: vehicle,
          });
        }

        return vehicle;
      }),

    // Desfazer devolução (volta para "no pátio")
    undoReturn: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const previous = await getVehicleById(input.id);
        const vehicle = await updateVehicle(input.id, {
          devolvido: "nao",
          dataDevolucao: null,
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
      }),

    // Consultar placa na API externa (experimental)
    searchPlate: protectedProcedure
      .input(z.object({ plate: z.string().min(7).max(8) }))
      .query(async ({ input }) => {
        const result = await searchPlate(input.plate);
        return result;
      }),
  }),

  // Router de logs de auditoria
  auditLogs: router({
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

    // Reverter uma ação
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

        switch (log.action) {
          case "criar_veiculo": {
            // Reverter criação = excluir o veículo
            await deleteVehicle(log.entityId);
            break;
          }
          case "editar_veiculo":
          case "marcar_pericia":
          case "reverter_pericia":
          case "marcar_devolvido":
          case "desfazer_devolucao": {
            // Reverter = restaurar dados anteriores
            if (!log.previousData) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Não há dados anteriores para restaurar" });
            }
            const prev = log.previousData as Record<string, unknown>;
            await updateVehicle(log.entityId, {
              placaOriginal: (prev.placaOriginal as string) ?? null,
              placaOstentada: (prev.placaOstentada as string) ?? null,
              marca: (prev.marca as string) ?? null,
              modelo: (prev.modelo as string) ?? null,
              cor: (prev.cor as string) ?? null,
              ano: (prev.ano as string) ?? null,
              anoModelo: (prev.anoModelo as string) ?? null,
              chassi: (prev.chassi as string) ?? null,
              combustivel: (prev.combustivel as string) ?? null,
              municipio: (prev.municipio as string) ?? null,
              uf: (prev.uf as string) ?? null,
              numeroProcedimento: (prev.numeroProcedimento as string) ?? null,
              numeroProcesso: (prev.numeroProcesso as string) ?? null,
              observacoes: (prev.observacoes as string) ?? null,
              statusPericia: (prev.statusPericia as "pendente" | "sem_pericia" | "feita") ?? "pendente",
              devolvido: (prev.devolvido as "sim" | "nao") ?? "nao",
              dataDevolucao: prev.dataDevolucao ? new Date(prev.dataDevolucao as string) : null,
            });
            break;
          }
          case "excluir_veiculo": {
            // Reverter exclusão = recriar o veículo com os dados anteriores
            if (!log.previousData) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Não há dados anteriores para restaurar" });
            }
            const prev = log.previousData as Record<string, unknown>;
            await createVehicle({
              placaOriginal: (prev.placaOriginal as string) ?? null,
              placaOstentada: (prev.placaOstentada as string) ?? null,
              marca: (prev.marca as string) ?? null,
              modelo: (prev.modelo as string) ?? null,
              cor: (prev.cor as string) ?? null,
              ano: (prev.ano as string) ?? null,
              anoModelo: (prev.anoModelo as string) ?? null,
              chassi: (prev.chassi as string) ?? null,
              combustivel: (prev.combustivel as string) ?? null,
              municipio: (prev.municipio as string) ?? null,
              uf: (prev.uf as string) ?? null,
              numeroProcedimento: (prev.numeroProcedimento as string) ?? null,
              numeroProcesso: (prev.numeroProcesso as string) ?? null,
              observacoes: (prev.observacoes as string) ?? null,
              statusPericia: (prev.statusPericia as "pendente" | "sem_pericia" | "feita") ?? "pendente",
              devolvido: (prev.devolvido as "sim" | "nao") ?? "nao",
              dataDevolucao: prev.dataDevolucao ? new Date(prev.dataDevolucao as string) : null,
              createdBy: prev.createdBy as number | null,
            });
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
          entityId: log.entityId,
          description: `Reverteu ação: ${log.description}`,
        });

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
