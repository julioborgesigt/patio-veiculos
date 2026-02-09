import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
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
} from "./db";
import { searchPlate } from "./plateService";

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
        console.log("[LOGIN] Attempt for:", input.username);

        const user = await getUserByUsername(input.username);
        console.log("[LOGIN] User lookup result:", user ? `found id=${user.id}, role=${user.role}` : "NOT FOUND");

        if (!user) {
          console.log("[LOGIN] FAIL: user not found in database");
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário ou senha inválidos",
          });
        }

        console.log("[LOGIN] Stored password length:", user.password?.length, "has colon:", user.password?.includes(":"));
        const passwordValid = verifyPassword(input.password, user.password);
        console.log("[LOGIN] Password verification result:", passwordValid);

        if (!passwordValid) {
          console.log("[LOGIN] FAIL: password mismatch");
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário ou senha inválidos",
          });
        }

        const sessionToken = await sdk.createSessionToken(
          { id: user.id, username: user.username, role: user.role },
          { expiresInMs: ONE_YEAR_MS }
        );
        console.log("[LOGIN] Token created, length:", sessionToken.length);

        const cookieOptions = getSessionCookieOptions(ctx.req);
        console.log("[LOGIN] Cookie options:", JSON.stringify(cookieOptions));
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        console.log("[LOGIN] SUCCESS for:", user.username);

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
        const vehicle = await createVehicle({
          ...input,
          createdBy: ctx.user.id,
        });
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
      .mutation(async ({ input }) => {
        const vehicle = await updateVehicle(input.id, input.data);
        return vehicle;
      }),

    // Deletar veículo
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await deleteVehicle(input.id);
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
      .mutation(async ({ input }) => {
        const vehicle = await updateVehicle(input.id, {
          devolvido: "sim",
          dataDevolucao: new Date(),
          statusPericia: "feita", // Atualiza perícia para "feita" automaticamente
        });
        return vehicle;
      }),

    // Desfazer devolução (volta para "no pátio")
    undoReturn: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const vehicle = await updateVehicle(input.id, {
          devolvido: "nao",
          dataDevolucao: null,
        });
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
      .mutation(async ({ input }) => {
        const vehicle = await updateVehicle(input.id, {
          statusPericia: input.status,
        });
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
});

export type AppRouter = typeof appRouter;
