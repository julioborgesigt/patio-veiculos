import { and, desc, eq, like, or, sql, asc, type Column } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import {
  users,
  vehicles,
  auditLogs,
  InsertVehicle,
  InsertAuditLog,
  AuditLog,
  Vehicle,
} from "../drizzle/schema";
import { logger } from "./_core/logger";
import { AsyncLocalStorage } from "node:async_hooks";

let _db: ReturnType<typeof drizzle> | null = null;

function buildDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;
  if (!DB_USER || !DB_PASSWORD || !DB_NAME) return undefined;

  const host = DB_HOST || "localhost";
  const encodedPassword = encodeURIComponent(DB_PASSWORD);
  return `mysql://${DB_USER}:${encodedPassword}@${host}/${DB_NAME}`;
}

export async function getDb() {
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

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DbTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbExecutor = DbClient | DbTransaction;

// Transação "ambiente" da operação atual (via AsyncLocalStorage). Permite que as
// funções de banco usem a transação automaticamente quando chamadas dentro de
// withTransaction, sem receber o handle por parâmetro (preserva as assinaturas).
const txStorage = new AsyncLocalStorage<DbTransaction>();

async function getExecutor(): Promise<DbExecutor | null> {
  return txStorage.getStore() ?? (await getDb());
}

/**
 * Executa `fn` dentro de uma transação. Qualquer função de banco chamada dentro
 * de `fn` participa da mesma transação; se `fn` lançar, tudo é desfeito (rollback),
 * garantindo que o dado do veículo e o respectivo log de auditoria nunca fiquem
 * dessincronizados.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await getDb();
  if (!client) throw new Error("Banco de dados indisponível");
  return client.transaction((tx) => txStorage.run(tx, fn));
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const newHash = scryptSync(password, salt, 64).toString("hex");
  // Use constant-time comparison; both buffers from scryptSync with keylen=64 are always 128 hex chars
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(newHash, "hex"));
  } catch {
    // timingSafeEqual throws if buffer lengths differ (shouldn't happen with fixed keylen)
    return false;
  }
}

// Hash descartável gerado uma vez por processo. Usado para igualar o tempo de
// resposta quando o usuário não existe, evitando enumeração de usuários por timing.
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("hex"));

/**
 * Executa um scrypt "às cegas" para consumir tempo equivalente a uma verificação real.
 * Deve ser chamada no fluxo de login quando o usuário não é encontrado.
 */
export function dummyPasswordCompare(password: string): void {
  verifyPassword(password, DUMMY_PASSWORD_HASH);
}

/**
 * Detecta erro de chave duplicada do MySQL (ER_DUP_ENTRY / errno 1062),
 * usado para tratar corrida na inserção de placa já existente.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; errno?: number };
  return e.code === "ER_DUP_ENTRY" || e.errno === 1062;
}

export async function getUserByUsername(username: string) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLastSignedIn(userId: number): Promise<void> {
  const db = await getExecutor();
  if (!db) return;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function seedDefaultAdmin(): Promise<void> {
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
      throw new Error("ADMIN_PASSWORD must be set — app cannot start without an admin account");
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
      lastSignedIn: new Date(),
    });
    logger.info("[Database]", `Default admin user created (${adminUser})`);
  } catch (error) {
    logger.error("[Database]", "Failed to seed admin:", error);
  }
}

// ========== VEHICLE OPERATIONS ==========

// mysql2 pode retornar colunas JSON como array já parseado ou como string
// serializada, dependendo da versão do driver e da configuração do typeCast.
// parseFotos normaliza os dois casos para sempre retornar string[].
function parseFotos(raw: unknown): string[] {
  if (Array.isArray(raw)) return (raw as unknown[]).filter((f): f is string => typeof f === "string");
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((f: unknown): f is string => typeof f === "string") : [];
    } catch { /* */ }
  }
  return [];
}

// Garante que fotos seja sempre string[] antes de sair do db layer,
// independente do que o driver retornou.
function normalizeVehicle(v: Vehicle): Vehicle {
  return { ...v, fotos: parseFotos(v.fotos) };
}

export interface VehicleFilters {
  search?: string;
  statusPericia?: "pendente" | "sem_pericia" | "feita";
  devolvido?: "sim" | "nao";
  tipoVeiculo?: "carro" | "moto" | "outros";
  dataInicio?: Date;
  dataFim?: Date;
  dataDevolucaoInicio?: Date;
  dataDevolucaoFim?: Date;
}

export interface VehicleListParams {
  filters?: VehicleFilters;
  page?: number;
  pageSize?: number;
  sortBy?: keyof Vehicle;
  sortOrder?: "asc" | "desc";
}

export async function findVehicleByPlaca(placaOriginal: string, excludeId?: number): Promise<Vehicle | null> {
  const db = await getExecutor();
  if (!db) return null;

  const conditions = [eq(vehicles.placaOriginal, placaOriginal)];
  if (excludeId !== undefined) {
    conditions.push(sql`${vehicles.id} != ${excludeId}`);
  }

  const [existing] = await db.select().from(vehicles).where(and(...conditions)).limit(1);
  return existing ? normalizeVehicle(existing) : null;
}

export async function createVehicle(vehicle: InsertVehicle): Promise<Vehicle | null> {
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

export async function updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | null> {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot update vehicle: database not available");
    return null;
  }

  await db.update(vehicles).set(vehicle).where(eq(vehicles.id, id));
  
  const [updatedVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return updatedVehicle ? normalizeVehicle(updatedVehicle) : null;
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot delete vehicle: database not available");
    return false;
  }

  const result = await db.delete(vehicles).where(eq(vehicles.id, id));
  return result[0].affectedRows > 0;
}

export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot get vehicle: database not available");
    return null;
  }

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return vehicle ? normalizeVehicle(vehicle) : null;
}

export async function listVehicles(params: VehicleListParams = {}): Promise<{ vehicles: Vehicle[]; total: number }> {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot list vehicles: database not available");
    return { vehicles: [], total: 0 };
  }

  const { filters = {}, page = 1, pageSize = 20, sortBy = "createdAt", sortOrder = "desc" } = params;
  
  const conditions: ReturnType<typeof eq>[] = [];
  
  // Search filter - searches across placas, processo, procedimento
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(vehicles.placaOriginal, searchTerm),
        like(vehicles.placaOstentada, searchTerm),
        like(vehicles.numeroProcesso, searchTerm),
        like(vehicles.numeroProcedimento, searchTerm)
      )!
    );
  }
  
  // Status filters
  if (filters.statusPericia) {
    conditions.push(eq(vehicles.statusPericia, filters.statusPericia));
  }
  
  if (filters.devolvido) {
    conditions.push(eq(vehicles.devolvido, filters.devolvido));
  }

  if (filters.tipoVeiculo) {
    conditions.push(eq(vehicles.tipoVeiculo, filters.tipoVeiculo));
  }

  // Date filters for createdAt
  if (filters.dataInicio) {
    conditions.push(sql`${vehicles.createdAt} >= ${filters.dataInicio}`);
  }
  if (filters.dataFim) {
    conditions.push(sql`${vehicles.createdAt} <= ${filters.dataFim}`);
  }
  
  // Date filters for dataDevolucao
  if (filters.dataDevolucaoInicio) {
    conditions.push(sql`${vehicles.dataDevolucao} >= ${filters.dataDevolucaoInicio}`);
  }
  if (filters.dataDevolucaoFim) {
    conditions.push(sql`${vehicles.dataDevolucao} <= ${filters.dataDevolucaoFim}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicles)
    .where(whereClause);
  const total = countResult[0]?.count || 0;
  
  // Get paginated results with sorting
  const offset = (page - 1) * pageSize;

  // Mapa de colunas válidas para ordenação
  const sortColumnMap: Record<string, Column> = {
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
    updatedAt: vehicles.updatedAt,
  };

  const sortColumn = sortColumnMap[sortBy] ?? vehicles.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const vehicleList = await db
    .select()
    .from(vehicles)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(pageSize)
    .offset(offset);
  
  return { vehicles: vehicleList.map(normalizeVehicle), total };
}

export async function getVehicleStats(): Promise<{
  totalNoPatio: number;
  totalDevolvidos: number;
  periciasPendentes: number;
  periciasFeitas: number;
  semPericia: number;
  totalGeral: number;
  totalCarros: number;
  totalMotos: number;
  totalOutros: number;
}> {
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
      totalOutros: 0,
    };
  }

  const [stats] = await db
    .select({
      totalGeral: sql<number>`count(*)`,
      totalNoPatio: sql<number>`sum(case when devolvido = 'nao' then 1 else 0 end)`,
      totalDevolvidos: sql<number>`sum(case when devolvido = 'sim' then 1 else 0 end)`,
      periciasPendentes: sql<number>`sum(case when devolvido = 'nao' and statusPericia = 'pendente' then 1 else 0 end)`,
      periciasFeitas: sql<number>`sum(case when statusPericia = 'feita' then 1 else 0 end)`,
      semPericia: sql<number>`sum(case when statusPericia = 'sem_pericia' then 1 else 0 end)`,
      totalCarros: sql<number>`sum(case when devolvido = 'nao' and tipoVeiculo = 'carro' then 1 else 0 end)`,
      totalMotos: sql<number>`sum(case when devolvido = 'nao' and tipoVeiculo = 'moto' then 1 else 0 end)`,
      totalOutros: sql<number>`sum(case when devolvido = 'nao' and tipoVeiculo = 'outros' then 1 else 0 end)`,
    })
    .from(vehicles);

  return {
    totalNoPatio: stats?.totalNoPatio || 0,
    totalDevolvidos: stats?.totalDevolvidos || 0,
    periciasPendentes: stats?.periciasPendentes || 0,
    periciasFeitas: stats?.periciasFeitas || 0,
    semPericia: stats?.semPericia || 0,
    totalGeral: stats?.totalGeral || 0,
    totalCarros: stats?.totalCarros || 0,
    totalMotos: stats?.totalMotos || 0,
    totalOutros: stats?.totalOutros || 0,
  };
}

export async function getAllVehiclesForExport(filters?: VehicleFilters): Promise<Vehicle[]> {
  const db = await getExecutor();
  if (!db) {
    logger.warn("[Database]", "Cannot export vehicles: database not available");
    return [];
  }

  const conditions: ReturnType<typeof eq>[] = [];
  
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        like(vehicles.placaOriginal, searchTerm),
        like(vehicles.placaOstentada, searchTerm),
        like(vehicles.numeroProcesso, searchTerm),
        like(vehicles.numeroProcedimento, searchTerm)
      )!
    );
  }
  
  if (filters?.statusPericia) {
    conditions.push(eq(vehicles.statusPericia, filters.statusPericia));
  }
  
  if (filters?.devolvido) {
    conditions.push(eq(vehicles.devolvido, filters.devolvido));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const rows = await db.select().from(vehicles).where(whereClause).orderBy(desc(vehicles.createdAt));
  return rows.map(normalizeVehicle);
}

// ========== AUDIT LOG OPERATIONS ==========

export async function createAuditLog(log: Omit<InsertAuditLog, "id" | "createdAt" | "reverted" | "revertedAt" | "revertedBy">): Promise<void> {
  const db = await getExecutor();
  if (!db) return;

  // Lança em caso de falha — dentro de withTransaction isso desfaz a operação
  // inteira (rollback), evitando alteração de dados sem o log correspondente.
  await db.insert(auditLogs).values(log);
}

export interface AuditLogFilters {
  action?: string;
  username?: string;
  entityId?: number;
}

export async function listAuditLogs(params: {
  filters?: AuditLogFilters;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const db = await getExecutor();
  if (!db) return { logs: [], total: 0 };

  const { filters = {}, page = 1, pageSize = 20 } = params;
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.action) {
    conditions.push(eq(auditLogs.action, filters.action as AuditLog["action"]));
  }
  if (filters.username) {
    conditions.push(like(auditLogs.username, `%${filters.username}%`));
  }
  if (filters.entityId) {
    conditions.push(eq(auditLogs.entityId, filters.entityId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * pageSize;
  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { logs, total };
}

export async function getAuditLogById(id: number): Promise<AuditLog | null> {
  const db = await getExecutor();
  if (!db) return null;

  const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return log || null;
}

export async function markAuditLogReverted(id: number, revertedByUserId: number): Promise<void> {
  const db = await getExecutor();
  if (!db) return;

  await db.update(auditLogs).set({
    reverted: "sim",
    revertedAt: new Date(),
    revertedBy: revertedByUserId,
  }).where(eq(auditLogs.id, id));
}
