// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 8;
var UNAUTHED_ERR_MSG = "Fa\xE7a login para continuar (10001)";
var MAX_BODY_SIZE = "5mb";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var requireAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(requireAdmin);

// server/routers/auth.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z } from "zod";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  const domain = process.env.COOKIE_DOMAIN || void 0;
  return {
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure,
    domain
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import { parse as parseCookieHeader } from "cookie";
import { randomBytes as randomBytes3 } from "crypto";
import { SignJWT, jwtVerify } from "jose";

// server/db.ts
import { and, desc, eq, like, or, sql, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// drizzle/schema.ts
import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 256 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    // Placas - suporte a duas placas para veículos clonados
    placaOriginal: varchar("placaOriginal", { length: 10 }),
    placaOstentada: varchar("placaOstentada", { length: 10 }),
    // Identificação do veículo
    tipoVeiculo: mysqlEnum("tipoVeiculo", ["carro", "moto", "outros"]),
    marca: varchar("marca", { length: 100 }),
    modelo: varchar("modelo", { length: 100 }),
    cor: varchar("cor", { length: 50 }),
    ano: varchar("ano", { length: 10 }),
    anoModelo: varchar("anoModelo", { length: 10 }),
    chassi: varchar("chassi", { length: 50 }),
    combustivel: varchar("combustivel", { length: 50 }),
    municipio: varchar("municipio", { length: 100 }),
    uf: varchar("uf", { length: 2 }),
    // Campos de procedimento e processo
    // Tipo de procedimento: IP, TCO, BOC, BO
    tipoProcedimento: mysqlEnum("tipoProcedimento", ["IP", "TCO", "BOC", "BO"]),
    // Formato procedimento: xxx-xxxxx/ano (ex: 001-00001/2024)
    numeroProcedimento: varchar("numeroProcedimento", { length: 20 }),
    // Formato processo: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)
    numeroProcesso: varchar("numeroProcesso", { length: 30 }),
    // Observações com limite de 200 caracteres
    observacoes: varchar("observacoes", { length: 200 }),
    // Fotos do veículo (até 2 URLs de imagem armazenadas no S3)
    fotos: json("fotos").$type(),
    // Status de perícia: pendente, sem_pericia, feita
    statusPericia: mysqlEnum("statusPericia", [
      "pendente",
      "sem_pericia",
      "feita"
    ]).default("pendente").notNull(),
    // Status de devolução
    devolvido: mysqlEnum("devolvido", ["sim", "nao"]).default("nao").notNull(),
    dataDevolucao: timestamp("dataDevolucao"),
    // Destino do veículo quando devolvido (obrigatório ao marcar como devolvido)
    destinoDevolucao: mysqlEnum("destinoDevolucao", ["restituido", "detran", "dra", "outros"]),
    // Descrição livre do destino quando destinoDevolucao = "outros" (até 50 caracteres)
    destinoDevolucaoDescricao: varchar("destinoDevolucaoDescricao", { length: 50 }),
    // Metadados
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    // Usuário que cadastrou
    createdBy: int("createdBy")
  },
  (table) => [
    // Índices para melhor performance em buscas frequentes.
    // placaOriginal é UNIQUE para impedir duplicidade mesmo sob requisições
    // concorrentes (MySQL permite múltiplos NULL, então veículos sem placa são aceitos).
    uniqueIndex("idx_placa_original").on(table.placaOriginal),
    index("idx_placa_ostentada").on(table.placaOstentada),
    index("idx_status").on(table.devolvido, table.statusPericia),
    index("idx_created_at").on(table.createdAt),
    index("idx_numero_processo").on(table.numeroProcesso),
    index("idx_numero_procedimento").on(table.numeroProcedimento)
  ]
);
var auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    // Quem fez a ação
    userId: int("userId").notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    // Tipo da ação
    action: mysqlEnum("action", [
      "criar_veiculo",
      "editar_veiculo",
      "excluir_veiculo",
      "marcar_pericia",
      "reverter_pericia",
      "marcar_devolvido",
      "desfazer_devolucao",
      "login",
      "reverter"
    ]).notNull(),
    // Entidade afetada
    entityType: mysqlEnum("entityType", ["vehicle", "user"]).default("vehicle").notNull(),
    entityId: int("entityId"),
    // Descrição legível da ação
    description: varchar("description", { length: 500 }).notNull(),
    // Dados anteriores (para reversão) e novos dados
    previousData: json("previousData"),
    newData: json("newData"),
    // Se esta ação foi revertida
    reverted: mysqlEnum("reverted", ["sim", "nao"]).default("nao").notNull(),
    revertedAt: timestamp("revertedAt"),
    revertedBy: int("revertedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_created").on(table.createdAt)
  ]
);

// server/_core/logger.ts
var isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
var logLevel = process.env.LOG_LEVEL || (isDev ? "debug" : "error");
var levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};
function shouldLog(level) {
  const currentLevel = logLevel in levels ? logLevel : "error";
  return levels[level] <= levels[currentLevel];
}
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "password",
  "token",
  "secret",
  "accessKey",
  "secretKey",
  "authorization",
  "cookie",
  "jti"
]);
function sanitize(value) {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Error) return { message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : sanitize(v);
  }
  return out;
}
function formatMessage(prefix, ...args) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const parts = args.map((a) => {
    if (a instanceof Error) return `${a.message}
${a.stack ?? ""}`;
    if (typeof a === "object") return JSON.stringify(sanitize(a));
    return String(a);
  });
  return `[${timestamp2}] ${prefix} ${parts.join(" ")}`;
}
var logger = {
  error: (prefix, ...args) => {
    if (shouldLog("error")) {
      console.error(formatMessage(prefix, ...args));
    }
  },
  warn: (prefix, ...args) => {
    if (shouldLog("warn")) {
      console.warn(formatMessage(prefix, ...args));
    }
  },
  info: (prefix, ...args) => {
    if (shouldLog("info")) {
      console.info(formatMessage(prefix, ...args));
    }
  },
  debug: (prefix, ...args) => {
    if (shouldLog("debug")) {
      console.log(formatMessage(prefix, ...args));
    }
  }
};

// server/db.ts
import { AsyncLocalStorage } from "node:async_hooks";
var _db = null;
function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;
  if (!DB_USER || !DB_PASSWORD || !DB_NAME) return void 0;
  const host = DB_HOST || "localhost";
  const encodedPassword = encodeURIComponent(DB_PASSWORD);
  return `mysql://${DB_USER}:${encodedPassword}@${host}/${DB_NAME}`;
}
async function getDb() {
  if (!_db) {
    const url = buildDatabaseUrl();
    if (!url) return null;
    try {
      _db = drizzle(url);
    } catch (error) {
      logger.error("[Database]", "Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
var txStorage = new AsyncLocalStorage();
async function getExecutor() {
  return txStorage.getStore() ?? await getDb();
}
async function withTransaction(fn) {
  const client = await getDb();
  if (!client) throw new Error("Banco de dados indispon\xEDvel");
  return client.transaction((tx) => txStorage.run(tx, fn));
}
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const newHash = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(newHash, "hex"));
  } catch {
    return false;
  }
}
var DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("hex"));
function dummyPasswordCompare(password) {
  verifyPassword(password, DUMMY_PASSWORD_HASH);
}
function isDuplicateKeyError(error) {
  if (!error || typeof error !== "object") return false;
  const e = error;
  return e.code === "ER_DUP_ENTRY" || e.errno === 1062;
}
async function getUserByUsername(username) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserById(id) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateLastSignedIn(userId) {
  const db = await getExecutor();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function seedDefaultAdmin() {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot seed admin: database not available");
    return;
  }
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    const env = process.env.NODE_ENV;
    if (env !== "development" && env !== "test") {
      throw new Error("ADMIN_PASSWORD must be set \u2014 app cannot start without an admin account");
    }
    logger.warn("[Database]", "ADMIN_PASSWORD not set, skipping admin seed (dev/test only)");
    return;
  }
  const existing = await getUserByUsername(adminUser);
  if (existing) return;
  try {
    await db.insert(users).values({
      username: adminUser,
      password: hashPassword(adminPassword),
      name: "Administrador",
      role: "admin",
      lastSignedIn: /* @__PURE__ */ new Date()
    });
    logger.info("[Database]", `Default admin user created (${adminUser})`);
  } catch (error) {
    logger.error("[Database]", "Failed to seed admin:", error);
  }
}
function parseFotos(raw) {
  if (Array.isArray(raw)) return raw.filter((f) => typeof f === "string");
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((f) => typeof f === "string") : [];
    } catch {
    }
  }
  return [];
}
function normalizeVehicle(v) {
  return { ...v, fotos: parseFotos(v.fotos) };
}
async function findVehicleByPlaca(placaOriginal, excludeId) {
  const db = await getExecutor();
  if (!db) return null;
  const conditions = [eq(vehicles.placaOriginal, placaOriginal)];
  if (excludeId !== void 0) {
    conditions.push(sql`${vehicles.id} != ${excludeId}`);
  }
  const [existing] = await db.select().from(vehicles).where(and(...conditions)).limit(1);
  return existing ? normalizeVehicle(existing) : null;
}
async function createVehicle(vehicle) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot create vehicle: database not available");
    return null;
  }
  const result = await db.insert(vehicles).values(vehicle);
  const insertId = result[0].insertId;
  const [newVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, insertId));
  return newVehicle ? normalizeVehicle(newVehicle) : null;
}
async function updateVehicle(id, vehicle) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot update vehicle: database not available");
    return null;
  }
  await db.update(vehicles).set(vehicle).where(eq(vehicles.id, id));
  const [updatedVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return updatedVehicle ? normalizeVehicle(updatedVehicle) : null;
}
async function deleteVehicle(id) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot delete vehicle: database not available");
    return false;
  }
  const result = await db.delete(vehicles).where(eq(vehicles.id, id));
  return result[0].affectedRows > 0;
}
async function getVehicleById(id) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get vehicle: database not available");
    return null;
  }
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return vehicle ? normalizeVehicle(vehicle) : null;
}
async function listVehicles(params = {}) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot list vehicles: database not available");
    return { vehicles: [], total: 0 };
  }
  const { filters = {}, page = 1, pageSize = 20, sortBy = "createdAt", sortOrder = "desc" } = params;
  const conditions = [];
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(vehicles.placaOriginal, searchTerm),
        like(vehicles.placaOstentada, searchTerm),
        like(vehicles.numeroProcesso, searchTerm),
        like(vehicles.numeroProcedimento, searchTerm)
      )
    );
  }
  if (filters.statusPericia) {
    conditions.push(eq(vehicles.statusPericia, filters.statusPericia));
  }
  if (filters.devolvido) {
    conditions.push(eq(vehicles.devolvido, filters.devolvido));
  }
  if (filters.tipoVeiculo) {
    conditions.push(eq(vehicles.tipoVeiculo, filters.tipoVeiculo));
  }
  if (filters.dataInicio) {
    conditions.push(sql`${vehicles.createdAt} >= ${filters.dataInicio}`);
  }
  if (filters.dataFim) {
    conditions.push(sql`${vehicles.createdAt} <= ${filters.dataFim}`);
  }
  if (filters.dataDevolucaoInicio) {
    conditions.push(sql`${vehicles.dataDevolucao} >= ${filters.dataDevolucaoInicio}`);
  }
  if (filters.dataDevolucaoFim) {
    conditions.push(sql`${vehicles.dataDevolucao} <= ${filters.dataDevolucaoFim}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
  const countResult = await db.select({ count: sql`count(*)` }).from(vehicles).where(whereClause);
  const total = countResult[0]?.count || 0;
  const offset = (page - 1) * pageSize;
  const sortColumnMap = {
    id: vehicles.id,
    placaOriginal: vehicles.placaOriginal,
    placaOstentada: vehicles.placaOstentada,
    marca: vehicles.marca,
    modelo: vehicles.modelo,
    cor: vehicles.cor,
    ano: vehicles.ano,
    anoModelo: vehicles.anoModelo,
    chassi: vehicles.chassi,
    municipio: vehicles.municipio,
    uf: vehicles.uf,
    numeroProcedimento: vehicles.numeroProcedimento,
    numeroProcesso: vehicles.numeroProcesso,
    statusPericia: vehicles.statusPericia,
    devolvido: vehicles.devolvido,
    dataDevolucao: vehicles.dataDevolucao,
    createdAt: vehicles.createdAt,
    updatedAt: vehicles.updatedAt
  };
  const sortColumn = sortColumnMap[sortBy] ?? vehicles.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;
  const vehicleList = await db.select().from(vehicles).where(whereClause).orderBy(orderFn(sortColumn)).limit(pageSize).offset(offset);
  return { vehicles: vehicleList.map(normalizeVehicle), total };
}
async function getVehicleStats() {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get stats: database not available");
    return {
      totalNoPatio: 0,
      totalDevolvidos: 0,
      periciasPendentes: 0,
      periciasFeitas: 0,
      semPericia: 0,
      totalGeral: 0,
      totalCarros: 0,
      totalMotos: 0,
      totalOutros: 0
    };
  }
  const [stats] = await db.select({
    totalGeral: sql`count(*)`,
    totalNoPatio: sql`sum(case when devolvido = 'nao' then 1 else 0 end)`,
    totalDevolvidos: sql`sum(case when devolvido = 'sim' then 1 else 0 end)`,
    periciasPendentes: sql`sum(case when devolvido = 'nao' and statusPericia = 'pendente' then 1 else 0 end)`,
    periciasFeitas: sql`sum(case when statusPericia = 'feita' then 1 else 0 end)`,
    semPericia: sql`sum(case when statusPericia = 'sem_pericia' then 1 else 0 end)`,
    totalCarros: sql`sum(case when devolvido = 'nao' and tipoVeiculo = 'carro' then 1 else 0 end)`,
    totalMotos: sql`sum(case when devolvido = 'nao' and tipoVeiculo = 'moto' then 1 else 0 end)`,
    totalOutros: sql`sum(case when devolvido = 'nao' and tipoVeiculo = 'outros' then 1 else 0 end)`
  }).from(vehicles);
  return {
    totalNoPatio: stats?.totalNoPatio || 0,
    totalDevolvidos: stats?.totalDevolvidos || 0,
    periciasPendentes: stats?.periciasPendentes || 0,
    periciasFeitas: stats?.periciasFeitas || 0,
    semPericia: stats?.semPericia || 0,
    totalGeral: stats?.totalGeral || 0,
    totalCarros: stats?.totalCarros || 0,
    totalMotos: stats?.totalMotos || 0,
    totalOutros: stats?.totalOutros || 0
  };
}
async function getAllVehiclesForExport(filters) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot export vehicles: database not available");
    return [];
  }
  const conditions = [];
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(vehicles.placaOriginal, searchTerm),
        like(vehicles.placaOstentada, searchTerm),
        like(vehicles.numeroProcesso, searchTerm),
        like(vehicles.numeroProcedimento, searchTerm)
      )
    );
  }
  if (filters?.statusPericia) {
    conditions.push(eq(vehicles.statusPericia, filters.statusPericia));
  }
  if (filters?.devolvido) {
    conditions.push(eq(vehicles.devolvido, filters.devolvido));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
  const rows = await db.select().from(vehicles).where(whereClause).orderBy(desc(vehicles.createdAt));
  return rows.map(normalizeVehicle);
}
async function createAuditLog(log) {
  const db = await getExecutor();
  if (!db) return;
  await db.insert(auditLogs).values(log);
}
async function listAuditLogs(params) {
  const db = await getExecutor();
  if (!db) return { logs: [], total: 0 };
  const { filters = {}, page = 1, pageSize = 20 } = params;
  const conditions = [];
  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters.username) {
    conditions.push(like(auditLogs.username, `%${filters.username}%`));
  }
  if (filters.entityId) {
    conditions.push(eq(auditLogs.entityId, filters.entityId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : void 0;
  const countResult = await db.select({ count: sql`count(*)` }).from(auditLogs).where(whereClause);
  const total = countResult[0]?.count || 0;
  const offset = (page - 1) * pageSize;
  const logs = await db.select().from(auditLogs).where(whereClause).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset);
  return { logs, total };
}
async function getAuditLogById(id) {
  const db = await getExecutor();
  if (!db) return null;
  const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return log || null;
}
async function markAuditLogReverted(id, revertedByUserId) {
  const db = await getExecutor();
  if (!db) return;
  await db.update(auditLogs).set({
    reverted: "sim",
    revertedAt: /* @__PURE__ */ new Date(),
    revertedBy: revertedByUserId
  }).where(eq(auditLogs.id, id));
}

// server/_core/env.ts
import { randomBytes as randomBytes2 } from "crypto";
var isProduction = process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
function getCookieSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && isProduction) {
    throw new Error("JWT_SECRET must be set in production environment");
  }
  if (!secret) {
    return randomBytes2(32).toString("hex");
  }
  return secret;
}
var ENV = {
  cookieSecret: getCookieSecret(),
  isProduction,
  // Storage de fotos (AWS S3 ou Cloudflare R2)
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3Region: process.env.AWS_REGION ?? "auto",
  s3Bucket: process.env.AWS_S3_BUCKET ?? "",
  // Endpoint customizado — obrigatório para R2, vazio para AWS S3
  s3Endpoint: process.env.AWS_S3_ENDPOINT ?? "",
  // URL base pública das fotos — obrigatório para R2 (ex: https://pub-xxx.r2.dev)
  s3PublicUrl: process.env.AWS_S3_PUBLIC_URL ?? ""
};

// server/_core/sdk.ts
var revokedTokens = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  revokedTokens.forEach((exp, jti) => {
    if (exp < now) revokedTokens.delete(jti);
  });
}, 60 * 60 * 1e3).unref();
var AuthService = class {
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  async createSessionToken(user, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? SESSION_TTL_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    const jti = randomBytes3(16).toString("hex");
    return new SignJWT({
      jti,
      userId: user.id,
      username: user.username,
      role: user.role
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) return null;
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { jti, userId, username, role } = payload;
      if (typeof userId !== "number" || typeof username !== "string" || typeof role !== "string") {
        return null;
      }
      if (typeof jti === "string" && revokedTokens.has(jti)) {
        return null;
      }
      return { userId, username, role };
    } catch {
      return null;
    }
  }
  /** Revokes the session cookie present in the request, if valid. */
  async revokeCurrentSession(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    if (!sessionCookie) return;
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(sessionCookie, secretKey, {
        algorithms: ["HS256"]
      });
      const { jti, exp } = payload;
      if (typeof jti === "string") {
        const expiresAt = typeof exp === "number" ? exp * 1e3 : Date.now() + SESSION_TTL_MS;
        revokedTokens.set(jti, expiresAt);
      }
    } catch {
    }
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const user = await getUserById(session.userId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    return user;
  }
};
var sdk = new AuthService();

// server/_core/loginRateLimit.ts
var WINDOW_MS = 15 * 60 * 1e3;
var MAX_ATTEMPTS = 5;
var attempts = /* @__PURE__ */ new Map();
function purgeExpired(now) {
  attempts.forEach((entry, ip) => {
    if (now > entry.resetAt) attempts.delete(ip);
  });
}
setInterval(() => purgeExpired(Date.now()), 60 * 1e3).unref();
function consumeLoginAttempt(ip) {
  const now = Date.now();
  if (attempts.size > 5e3) purgeExpired(now);
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}
function resetLoginAttempts(ip) {
  attempts.delete(ip);
}

// server/routers/auth.ts
var authRouter = router({
  me: publicProcedure.query((opts) => {
    const user = opts.ctx.user;
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };
  }),
  login: publicProcedure.input(z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  })).mutation(async ({ input, ctx }) => {
    const ip = ctx.req.ip || "unknown";
    if (!consumeLoginAttempt(ip)) {
      throw new TRPCError2({
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas de login. Aguarde 15 minutos."
      });
    }
    const user = await getUserByUsername(input.username);
    if (!user) {
      dummyPasswordCompare(input.password);
      throw new TRPCError2({
        code: "UNAUTHORIZED",
        message: "Usu\xE1rio ou senha inv\xE1lidos"
      });
    }
    const passwordValid = verifyPassword(input.password, user.password);
    if (!passwordValid) {
      throw new TRPCError2({
        code: "UNAUTHORIZED",
        message: "Usu\xE1rio ou senha inv\xE1lidos"
      });
    }
    resetLoginAttempts(ip);
    await updateLastSignedIn(user.id);
    const sessionToken = await sdk.createSessionToken(
      { id: user.id, username: user.username, role: user.role },
      { expiresInMs: SESSION_TTL_MS }
    );
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_TTL_MS });
    try {
      await createAuditLog({
        userId: user.id,
        username: user.username,
        action: "login",
        entityType: "user",
        entityId: user.id,
        description: `${user.username} fez login no sistema`
      });
    } catch (err) {
      logger.error("[Auth]", "Falha ao registrar log de login:", err);
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await sdk.revokeCurrentSession(ctx.req);
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true };
  })
});

// server/routers/vehicles.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/plateService.ts
import axios from "axios";
var PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
async function searchPlate(plate) {
  const normalizedPlate = plate.replace(/[-\s]/g, "").toUpperCase();
  if (!PLATE_REGEX.test(normalizedPlate)) {
    return {
      success: false,
      data: null,
      error: "Formato de placa inv\xE1lido. Use o formato ABC1234 ou ABC1D23."
    };
  }
  const token = process.env.API_PLACAS_TOKEN;
  if (!token) {
    logger.error("[PlateService]", "Token da API Placas n\xE3o configurado");
    return {
      success: false,
      data: null,
      error: "Servi\xE7o de consulta n\xE3o configurado. Entre em contato com o administrador."
    };
  }
  try {
    const apiUrl = `https://wdapi2.com.br/consulta/${normalizedPlate}/${token}`;
    logger.debug("[PlateService]", `Consultando placa ${normalizedPlate}...`);
    const response = await axios.get(apiUrl, {
      timeout: 15e3,
      headers: {
        Accept: "application/json"
      }
    });
    const result = response.data;
    if (response.status !== 200) {
      logger.error("[PlateService]", `Erro na API: ${response.status}`);
      return {
        success: false,
        data: null,
        error: result.message || "Erro ao consultar a placa."
      };
    }
    const vehicleData = {
      marca: result.MARCA || result.marca || null,
      modelo: result.MODELO || result.modelo || null,
      cor: result.cor || null,
      ano: result.ano || null,
      anoModelo: result.anoModelo || null,
      chassi: result.chassi || null,
      combustivel: result.extra?.combustivel || null,
      municipio: result.municipio || null,
      uf: result.uf || null,
      situacao: result.situacao || null
    };
    logger.debug(
      "[PlateService]",
      `Consulta bem-sucedida para placa ${normalizedPlate}`
    );
    return {
      success: true,
      data: vehicleData,
      error: null
    };
  } catch (error) {
    logger.error("[PlateService]", "Erro ao consultar placa");
    let errorMessage = "Erro ao consultar a placa. Tente novamente.";
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;
      if (status === 400) {
        errorMessage = "URL incorreta. Entre em contato com o administrador.";
      } else if (status === 401) {
        errorMessage = message || "Placa inv\xE1lida. Verifique o formato.";
      } else if (status === 402) {
        errorMessage = "Token inv\xE1lido. Entre em contato com o administrador.";
      } else if (status === 406) {
        errorMessage = "Ve\xEDculo n\xE3o encontrado na base de dados.";
      } else if (status === 429) {
        errorMessage = "Limite de consultas atingido. Aguarde ou entre em contato com o administrador.";
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "A consulta demorou muito. Tente novamente.";
      } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        errorMessage = "Servi\xE7o temporariamente indispon\xEDvel. Tente novamente mais tarde.";
      }
    }
    return {
      success: false,
      data: null,
      error: errorMessage
    };
  }
}

// server/_core/storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function isS3Configured() {
  return !!(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey);
}
function createS3Client() {
  return new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || void 0,
    // R2 exige endpoint; S3 não usa
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey
    }
  });
}
async function generatePresignedUploadUrl(key) {
  if (!isS3Configured()) {
    throw new Error("Storage n\xE3o configurado. Configure AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.");
  }
  const s3 = createS3Client();
  const command = new PutObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: key,
    ContentType: "image/jpeg"
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}
function getStoragePublicBase() {
  if (!isS3Configured()) return "";
  if (ENV.s3PublicUrl) {
    return ENV.s3PublicUrl.endsWith("/") ? ENV.s3PublicUrl : `${ENV.s3PublicUrl}/`;
  }
  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/`;
}
function isStorageUrl(url) {
  const base = getStoragePublicBase();
  if (!base) return false;
  return url.startsWith(base);
}
function getS3PublicUrl(key) {
  if (ENV.s3PublicUrl) {
    const base = ENV.s3PublicUrl.endsWith("/") ? ENV.s3PublicUrl : `${ENV.s3PublicUrl}/`;
    return `${base}${key}`;
  }
  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/${key}`;
}
var MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
async function validateUploadedPhoto(publicUrl) {
  if (!isS3Configured()) return { valid: false, reason: "storage not configured" };
  const base = getStoragePublicBase();
  if (!base || !publicUrl.startsWith(base)) return { valid: false, reason: "URL not in storage" };
  const key = publicUrl.slice(base.length);
  try {
    const s3 = createS3Client();
    const head = await s3.send(new HeadObjectCommand({ Bucket: ENV.s3Bucket, Key: key }));
    const contentType = head.ContentType ?? "";
    const size = head.ContentLength ?? 0;
    if (!contentType.startsWith("image/")) {
      return { valid: false, reason: `invalid content-type: ${contentType}` };
    }
    if (size > MAX_PHOTO_SIZE_BYTES) {
      return { valid: false, reason: `file too large: ${size} bytes` };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "could not verify object" };
  }
}
async function deleteS3ObjectByUrl(publicUrl, opts) {
  if (!isS3Configured()) return;
  try {
    const base = getStoragePublicBase();
    if (!base || !publicUrl.startsWith(base)) return;
    const key = publicUrl.slice(base.length);
    if (opts?.keyPrefix && !key.startsWith(opts.keyPrefix)) return;
    const s3 = createS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: key }));
  } catch {
  }
}

// server/routers/vehicles.ts
import { nanoid } from "nanoid";
async function assertFotosAreImages(fotos) {
  if (!fotos?.length) return;
  for (const url of fotos) {
    const result = await validateUploadedPhoto(url);
    if (!result.valid) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: `Foto inv\xE1lida ou n\xE3o encontrada no storage: ${result.reason ?? url}`
      });
    }
  }
}
function describeVehicle(v) {
  const placa = v.placaOriginal || "sem placa";
  const desc2 = [v.marca, v.modelo].filter(Boolean).join(" ") || "ve\xEDculo";
  return `${placa} (${desc2})`;
}
var destinoDevolucaoEnum = z2.enum(["restituido", "detran", "dra", "outros"]);
var DESTINO_LABELS = {
  restituido: "Restitu\xEDdo",
  detran: "Detran",
  dra: "DRA",
  outros: "Outros"
};
function assertDestino(devolvido, destino, descricao) {
  if (devolvido !== "sim") return;
  if (!destino) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: "Informe o destino do ve\xEDculo devolvido." });
  }
  if (destino === "outros" && !descricao?.trim()) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: 'Descreva o destino quando selecionar "Outros".' });
  }
}
function normalizeDestino(devolvido, destino, descricao) {
  if (devolvido !== "sim" || !destino) {
    return { destinoDevolucao: null, destinoDevolucaoDescricao: null };
  }
  const destinoDevolucaoDescricao = destino === "outros" ? descricao?.trim() || null : null;
  return { destinoDevolucao: destino, destinoDevolucaoDescricao };
}
var procedimentoRegex = /^\d{3}-\d{5}\/\d{4}$/;
var processoRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
var vehicleInputSchema = z2.object({
  placaOriginal: z2.string().max(10).optional().nullable(),
  placaOstentada: z2.string().max(10).optional().nullable(),
  marca: z2.string().max(100).optional().nullable(),
  modelo: z2.string().max(100).optional().nullable(),
  cor: z2.string().max(50).optional().nullable(),
  ano: z2.string().max(10).optional().nullable(),
  anoModelo: z2.string().max(10).optional().nullable(),
  chassi: z2.string().max(50).optional().nullable(),
  combustivel: z2.string().max(50).optional().nullable(),
  municipio: z2.string().max(100).optional().nullable(),
  uf: z2.string().max(2).optional().nullable(),
  tipoVeiculo: z2.enum(["carro", "moto", "outros"]).optional().nullable(),
  tipoProcedimento: z2.enum(["IP", "TCO", "BOC", "BO"]).optional().nullable(),
  numeroProcedimento: z2.string().max(20).optional().nullable().refine(
    (val) => !val || procedimentoRegex.test(val),
    { message: "Formato inv\xE1lido. Use: xxx-xxxxx/ano (ex: 001-00001/2024)" }
  ),
  numeroProcesso: z2.string().max(30).optional().nullable().refine(
    (val) => !val || processoRegex.test(val),
    { message: "Formato inv\xE1lido. Use: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)" }
  ),
  observacoes: z2.string().max(200).optional().nullable(),
  statusPericia: z2.enum(["pendente", "sem_pericia", "feita"]).default("pendente"),
  devolvido: z2.enum(["sim", "nao"]).default("nao"),
  dataDevolucao: z2.date().optional().nullable(),
  destinoDevolucao: destinoDevolucaoEnum.optional().nullable(),
  destinoDevolucaoDescricao: z2.string().max(50).optional().nullable(),
  fotos: z2.array(
    z2.string().url().refine(isStorageUrl, {
      message: "URL de foto inv\xE1lida (fora do storage configurado)"
    })
  ).max(2).optional().nullable()
});
var filtersSchema = z2.object({
  search: z2.string().optional(),
  statusPericia: z2.enum(["pendente", "sem_pericia", "feita"]).optional(),
  devolvido: z2.enum(["sim", "nao"]).optional(),
  tipoVeiculo: z2.enum(["carro", "moto", "outros"]).optional(),
  dataInicio: z2.date().optional(),
  dataFim: z2.date().optional(),
  dataDevolucaoInicio: z2.date().optional(),
  dataDevolucaoFim: z2.date().optional()
});
var VALID_SORT_FIELDS = [
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
  "updatedAt"
];
var listParamsSchema = z2.object({
  filters: filtersSchema.optional(),
  page: z2.number().min(1).default(1),
  pageSize: z2.number().min(1).max(100).default(20),
  sortBy: z2.enum(VALID_SORT_FIELDS).optional(),
  sortOrder: z2.enum(["asc", "desc"]).default("desc")
});
var vehiclesRouter = router({
  // Criar veículo
  create: protectedProcedure.input(vehicleInputSchema).mutation(async ({ input, ctx }) => {
    assertDestino(input.devolvido, input.destinoDevolucao, input.destinoDevolucaoDescricao);
    await assertFotosAreImages(input.fotos);
    if (input.placaOriginal) {
      const existing = await findVehicleByPlaca(input.placaOriginal);
      if (existing) {
        throw new TRPCError3({
          code: "CONFLICT",
          message: `J\xE1 existe um ve\xEDculo cadastrado com a placa original ${input.placaOriginal}`
        });
      }
    }
    let vehicle;
    try {
      vehicle = await withTransaction(async () => {
        const created = await createVehicle({
          ...input,
          ...normalizeDestino(input.devolvido, input.destinoDevolucao, input.destinoDevolucaoDescricao),
          createdBy: ctx.user.id
        });
        if (created) {
          await createAuditLog({
            userId: ctx.user.id,
            username: ctx.user.username,
            action: "criar_veiculo",
            entityType: "vehicle",
            entityId: created.id,
            description: `Cadastrou ve\xEDculo ${describeVehicle(created)}`,
            newData: created
          });
        }
        return created;
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new TRPCError3({
          code: "CONFLICT",
          message: `J\xE1 existe um ve\xEDculo cadastrado com a placa original ${input.placaOriginal}`
        });
      }
      throw err;
    }
    return vehicle;
  }),
  // Atualizar veículo
  update: protectedProcedure.input(
    z2.object({
      id: z2.number(),
      data: vehicleInputSchema.partial()
    })
  ).mutation(async ({ input, ctx }) => {
    assertDestino(input.data.devolvido, input.data.destinoDevolucao, input.data.destinoDevolucaoDescricao);
    await assertFotosAreImages(input.data.fotos);
    if (input.data.placaOriginal) {
      const existing = await findVehicleByPlaca(input.data.placaOriginal, input.id);
      if (existing) {
        throw new TRPCError3({
          code: "CONFLICT",
          message: `J\xE1 existe um ve\xEDculo cadastrado com a placa original ${input.data.placaOriginal}`
        });
      }
    }
    const dataToUpdate = input.data.devolvido !== void 0 ? { ...input.data, ...normalizeDestino(input.data.devolvido, input.data.destinoDevolucao, input.data.destinoDevolucaoDescricao) } : input.data;
    let vehicle;
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
            description: `Editou ve\xEDculo ${describeVehicle(updated)}`,
            previousData: previous,
            newData: updated
          });
        }
        return updated;
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new TRPCError3({
          code: "CONFLICT",
          message: `J\xE1 existe um ve\xEDculo cadastrado com a placa original ${input.data.placaOriginal}`
        });
      }
      throw err;
    }
    return vehicle;
  }),
  // Deletar veículo — restrito a admins (ação irreversível via UI)
  delete: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
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
          description: `Excluiu ve\xEDculo ${describeVehicle(previous)}`,
          previousData: previous
        });
      }
      return ok;
    });
    if (success && previous) {
      for (const url of previous.fotos ?? []) {
        deleteS3ObjectByUrl(url).catch((err) => {
          logger.warn("[Storage]", `Failed to delete photo ${url}:`, err);
        });
      }
    }
    return { success };
  }),
  // Buscar veículo por ID
  getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
    const vehicle = await getVehicleById(input.id);
    return vehicle;
  }),
  // Listar veículos com filtros e paginação
  list: protectedProcedure.input(listParamsSchema).query(async ({ input }) => {
    const result = await listVehicles({
      filters: input.filters,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder
    });
    return result;
  }),
  // Estatísticas do dashboard
  stats: protectedProcedure.query(async () => {
    const stats = await getVehicleStats();
    return stats;
  }),
  // Exportar todos os veículos (para CSV/Excel) — restrito a admins (acesso bulk a dados)
  export: adminProcedure.input(filtersSchema.optional()).query(async ({ input }) => {
    const vehicles2 = await getAllVehiclesForExport(input);
    return vehicles2;
  }),
  // Marcar como devolvido (atualiza status e perícia automaticamente)
  markAsReturned: protectedProcedure.input(
    z2.object({
      id: z2.number(),
      destinoDevolucao: destinoDevolucaoEnum,
      destinoDevolucaoDescricao: z2.string().max(50).optional().nullable()
    })
  ).mutation(async ({ input, ctx }) => {
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
        dataDevolucao: /* @__PURE__ */ new Date(),
        statusPericia: "feita",
        destinoDevolucao,
        destinoDevolucaoDescricao
      });
      if (vehicle && previous) {
        const destinoTexto = destinoDevolucaoDescricao ? `${DESTINO_LABELS[input.destinoDevolucao]}: ${destinoDevolucaoDescricao}` : DESTINO_LABELS[input.destinoDevolucao];
        await createAuditLog({
          userId: ctx.user.id,
          username: ctx.user.username,
          action: "marcar_devolvido",
          entityType: "vehicle",
          entityId: vehicle.id,
          description: `Marcou ve\xEDculo ${describeVehicle(vehicle)} como devolvido (${destinoTexto})`,
          previousData: previous,
          newData: vehicle
        });
      }
      return vehicle;
    });
  }),
  // Desfazer devolução (volta para "no pátio")
  undoReturn: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
    return withTransaction(async () => {
      const previous = await getVehicleById(input.id);
      const vehicle = await updateVehicle(input.id, {
        devolvido: "nao",
        dataDevolucao: null,
        destinoDevolucao: null,
        destinoDevolucaoDescricao: null
      });
      if (vehicle && previous) {
        await createAuditLog({
          userId: ctx.user.id,
          username: ctx.user.username,
          action: "desfazer_devolucao",
          entityType: "vehicle",
          entityId: vehicle.id,
          description: `Desfez devolu\xE7\xE3o do ve\xEDculo ${describeVehicle(vehicle)}`,
          previousData: previous,
          newData: vehicle
        });
      }
      return vehicle;
    });
  }),
  // Atualizar status de perícia
  updatePericiaStatus: protectedProcedure.input(
    z2.object({
      id: z2.number(),
      status: z2.enum(["pendente", "sem_pericia", "feita"])
    })
  ).mutation(async ({ input, ctx }) => {
    return withTransaction(async () => {
      const previous = await getVehicleById(input.id);
      const vehicle = await updateVehicle(input.id, {
        statusPericia: input.status
      });
      if (vehicle && previous) {
        const action = input.status === "pendente" ? "reverter_pericia" : "marcar_pericia";
        const actionDesc = input.status === "pendente" ? `Reverteu per\xEDcia do ve\xEDculo ${describeVehicle(vehicle)} para pendente` : `Marcou per\xEDcia do ve\xEDculo ${describeVehicle(vehicle)} como ${input.status === "feita" ? "feita" : "sem per\xEDcia"}`;
        await createAuditLog({
          userId: ctx.user.id,
          username: ctx.user.username,
          action,
          entityType: "vehicle",
          entityId: vehicle.id,
          description: actionDesc,
          previousData: previous,
          newData: vehicle
        });
      }
      return vehicle;
    });
  }),
  // Consultar placa na API externa (experimental)
  searchPlate: protectedProcedure.input(z2.object({ plate: z2.string().min(7).max(8) })).query(async ({ input }) => {
    const result = await searchPlate(input.plate);
    return result;
  }),
  // Gerar presigned URL para upload de foto ao S3
  getUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isS3Configured()) {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "Upload de fotos n\xE3o configurado. Configure AWS_S3_BUCKET, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no servidor."
      });
    }
    const key = `vehicles/${ctx.user.id}/${Date.now()}-${nanoid(8)}.jpg`;
    const presignedUrl = await generatePresignedUploadUrl(key);
    const publicUrl = getS3PublicUrl(key);
    return { presignedUrl, publicUrl };
  }),
  // Deletar foto órfã do S3 (ex: upload feito mas cadastro cancelado).
  // Só permite apagar objetos sob o prefixo do próprio usuário (evita IDOR).
  deletePhoto: protectedProcedure.input(z2.object({ url: z2.string().url() })).mutation(async ({ input, ctx }) => {
    await deleteS3ObjectByUrl(input.url, { keyPrefix: `vehicles/${ctx.user.id}/` });
    return { success: true };
  })
});

// server/routers/auditLogs.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
var nstr = z3.preprocess(
  (v) => typeof v === "string" ? v : null,
  z3.string().nullable()
);
var fotosSchema = z3.preprocess(
  (v) => {
    if (Array.isArray(v)) return v.filter((f) => typeof f === "string");
    if (typeof v === "string") {
      try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p.filter((f) => typeof f === "string") : null;
      } catch {
        return null;
      }
    }
    return null;
  },
  z3.array(z3.string()).nullable()
);
var vehiclePreviousDataSchema = z3.object({
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
  tipoVeiculo: z3.preprocess(
    (v) => ["carro", "moto", "outros"].includes(v) ? v : null,
    z3.enum(["carro", "moto", "outros"]).nullable()
  ),
  tipoProcedimento: z3.preprocess(
    (v) => ["IP", "TCO", "BOC", "BO"].includes(v) ? v : null,
    z3.enum(["IP", "TCO", "BOC", "BO"]).nullable()
  ),
  numeroProcedimento: nstr,
  numeroProcesso: nstr,
  observacoes: nstr,
  statusPericia: z3.preprocess(
    (v) => ["pendente", "sem_pericia", "feita"].includes(v) ? v : "pendente",
    z3.enum(["pendente", "sem_pericia", "feita"])
  ),
  devolvido: z3.preprocess(
    (v) => ["sim", "nao"].includes(v) ? v : "nao",
    z3.enum(["sim", "nao"])
  ),
  dataDevolucao: z3.preprocess(
    (v) => {
      if (!v) return null;
      if (v instanceof Date) return v;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    },
    z3.date().nullable()
  ),
  destinoDevolucao: z3.preprocess(
    (v) => ["restituido", "detran", "dra", "outros"].includes(v) ? v : null,
    z3.enum(["restituido", "detran", "dra", "outros"]).nullable()
  ),
  destinoDevolucaoDescricao: nstr,
  fotos: fotosSchema,
  createdBy: z3.preprocess(
    (v) => typeof v === "number" ? v : null,
    z3.number().nullable()
  )
}).passthrough();
function parseVehicleData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "Dados anteriores inv\xE1lidos" });
  }
  const result = vehiclePreviousDataSchema.safeParse(data);
  if (!result.success) {
    throw new TRPCError4({ code: "BAD_REQUEST", message: "Dados anteriores inv\xE1lidos" });
  }
  return result.data;
}
var auditLogsRouter = router({
  list: protectedProcedure.input(
    z3.object({
      filters: z3.object({
        action: z3.string().optional(),
        username: z3.string().optional(),
        entityId: z3.number().optional()
      }).optional(),
      page: z3.number().min(1).default(1),
      pageSize: z3.number().min(1).max(100).default(20)
    })
  ).query(async ({ input }) => {
    return listAuditLogs({
      filters: input.filters,
      page: input.page,
      pageSize: input.pageSize
    });
  }),
  // Reverter uma ação — restrito a admins (operação destrutiva e irreversível).
  revert: adminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input, ctx }) => {
    const log = await getAuditLogById(input.id);
    if (!log) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "Log n\xE3o encontrado" });
    }
    if (log.reverted === "sim") {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Esta a\xE7\xE3o j\xE1 foi revertida" });
    }
    if (log.entityType !== "vehicle" || !log.entityId) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Esta a\xE7\xE3o n\xE3o pode ser revertida" });
    }
    const entityId = log.entityId;
    const photosToDelete = [];
    const cleanupPhotos = (urls) => {
      photosToDelete.push(...urls);
    };
    await withTransaction(async () => {
      let revertedEntityId = entityId;
      switch (log.action) {
        case "criar_veiculo": {
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
          if (!log.previousData) {
            throw new TRPCError4({ code: "BAD_REQUEST", message: "N\xE3o h\xE1 dados anteriores para restaurar" });
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
              fotos: prev.fotos
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) {
              throw new TRPCError4({
                code: "CONFLICT",
                message: "N\xE3o foi poss\xEDvel reverter: a placa original j\xE1 pertence a outro ve\xEDculo."
              });
            }
            throw err;
          }
          if (current) {
            const restored = new Set(prev.fotos ?? []);
            cleanupPhotos((parseVehicleData(current).fotos ?? []).filter((u) => !restored.has(u)));
          }
          break;
        }
        case "excluir_veiculo": {
          if (!log.previousData) {
            throw new TRPCError4({ code: "BAD_REQUEST", message: "N\xE3o h\xE1 dados anteriores para restaurar" });
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
              createdBy: prev.createdBy
            });
          } catch (err) {
            if (isDuplicateKeyError(err)) {
              throw new TRPCError4({
                code: "CONFLICT",
                message: "N\xE3o foi poss\xEDvel reverter: a placa original j\xE1 pertence a outro ve\xEDculo."
              });
            }
            throw err;
          }
          if (recreated) revertedEntityId = recreated.id;
          break;
        }
        default:
          throw new TRPCError4({ code: "BAD_REQUEST", message: "Esta a\xE7\xE3o n\xE3o pode ser revertida" });
      }
      await markAuditLogReverted(log.id, ctx.user.id);
      await createAuditLog({
        userId: ctx.user.id,
        username: ctx.user.username,
        action: "reverter",
        entityType: "vehicle",
        entityId: revertedEntityId,
        description: `Reverteu a\xE7\xE3o: ${log.description}`
      });
    });
    for (const url of photosToDelete) {
      deleteS3ObjectByUrl(url).catch((err) => {
        logger.warn("[Storage]", `Failed to delete photo ${url} after revert:`, err);
      });
    }
    return { success: true };
  })
});

// server/routers.ts
var appRouter = router({
  auth: authRouter,
  vehicles: vehiclesRouter,
  auditLogs: auditLogsRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    if (!(error instanceof HttpError)) {
      logger.warn("[Auth]", "Unexpected authentication error:", error);
    }
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid as nanoid2 } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  const isProduction2 = process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";
  app.set("trust proxy", 1);
  const cspImgSrc = ["'self'", "data:", "blob:"];
  const cspConnectSrc = ["'self'"];
  if (ENV.s3PublicUrl) {
    try {
      cspImgSrc.push(new URL(ENV.s3PublicUrl).origin);
    } catch {
    }
  } else if (ENV.s3Bucket && ENV.s3Region) {
    cspImgSrc.push(`https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com`);
  }
  if (ENV.s3Endpoint) {
    try {
      const endpointUrl = new URL(ENV.s3Endpoint);
      cspConnectSrc.push(endpointUrl.origin);
      if (ENV.s3Bucket) {
        cspConnectSrc.push(`${endpointUrl.protocol}//${ENV.s3Bucket}.${endpointUrl.host}`);
      }
    } catch {
    }
  } else if (ENV.s3Bucket && ENV.s3Region) {
    cspConnectSrc.push(`https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com`);
  }
  app.use(helmet({
    contentSecurityPolicy: isProduction2 ? {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "img-src": cspImgSrc,
        "connect-src": cspConnectSrc
      }
    } : false,
    // Force HTTPS for 1 year in production; browsers will refuse HTTP connections
    hsts: isProduction2 ? { maxAge: 31536e3, includeSubDomains: true } : false
  }));
  const corsOrigin = process.env.CORS_ORIGIN || (isProduction2 ? false : true);
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 100,
    message: { error: "Muitas requisi\xE7\xF5es, tente novamente mais tarde." },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api/", apiLimiter);
  app.use(express2.json({ limit: MAX_BODY_SIZE }));
  app.use(express2.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));
  app.get("/health", async (_req, res) => {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ status: "database_unavailable", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      return;
    }
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  await seedDefaultAdmin().catch((err) => {
    logger.error("[Server]", "Failed to seed admin:", err);
    if (isProduction2) throw err;
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (!isProduction2) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const portStr = process.env.PORT || "3000";
  const preferredPort = parseInt(portStr, 10);
  if (isNaN(preferredPort) || preferredPort <= 0 || preferredPort > 65535) {
    throw new Error(`Invalid PORT value: "${portStr}"`);
  }
  let port = preferredPort;
  if (!isProduction2) {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      logger.info("[Server]", `Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }
  server.on("error", (err) => {
    logger.error("[Server]", `Failed to bind on port ${port}:`, err);
    process.exit(1);
  });
  server.listen(port, () => {
    logger.info("[Server]", `Server running on http://localhost:${port}/`);
  });
}
startServer().catch((err) => {
  logger.error("[Server]", "Failed to start server:", err);
  process.exit(1);
});
