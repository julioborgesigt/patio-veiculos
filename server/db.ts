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
      logger.warn("[Database]", "Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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
  if (hash.length !== newHash.length) return false;
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(newHash, "hex"));
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function seedDefaultAdmin(): Promise<void> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot seed admin: database not available");
    return;
  }

  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    logger.warn("[Database]", "ADMIN_PASSWORD not set, skipping admin seed");
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

export interface VehicleFilters {
  search?: string;
  statusPericia?: "pendente" | "sem_pericia" | "feita";
  devolvido?: "sim" | "nao";
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
  const db = await getDb();
  if (!db) return null;

  const conditions = [eq(vehicles.placaOriginal, placaOriginal)];
  if (excludeId !== undefined) {
    conditions.push(sql`${vehicles.id} != ${excludeId}`);
  }

  const [existing] = await db.select().from(vehicles).where(and(...conditions)).limit(1);
  return existing || null;
}

export async function createVehicle(vehicle: InsertVehicle): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot create vehicle: database not available");
    return null;
  }

  const result = await db.insert(vehicles).values(vehicle);
  const insertId = result[0].insertId;

  const [newVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, insertId));
  return newVehicle || null;
}

export async function updateVehicle(id: number, vehicle: Partial<InsertVehicle>): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot update vehicle: database not available");
    return null;
  }

  await db.update(vehicles).set(vehicle).where(eq(vehicles.id, id));
  
  const [updatedVehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return updatedVehicle || null;
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot delete vehicle: database not available");
    return false;
  }

  const result = await db.delete(vehicles).where(eq(vehicles.id, id));
  return result[0].affectedRows > 0;
}

export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot get vehicle: database not available");
    return null;
  }

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return vehicle || null;
}

export async function listVehicles(params: VehicleListParams = {}): Promise<{ vehicles: Vehicle[]; total: number }> {
  const db = await getDb();
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
  
  return { vehicles: vehicleList, total };
}

export async function getVehicleStats(): Promise<{
  totalNoPatio: number;
  totalDevolvidos: number;
  periciasPendentes: number;
  periciasFeitas: number;
  semPericia: number;
  totalGeral: number;
}> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot get stats: database not available");
    return {
      totalNoPatio: 0,
      totalDevolvidos: 0,
      periciasPendentes: 0,
      periciasFeitas: 0,
      semPericia: 0,
      totalGeral: 0,
    };
  }

  const [stats] = await db
    .select({
      totalGeral: sql<number>`count(*)`,
      totalNoPatio: sql<number>`sum(case when devolvido = 'nao' then 1 else 0 end)`,
      totalDevolvidos: sql<number>`sum(case when devolvido = 'sim' then 1 else 0 end)`,
      periciasPendentes: sql<number>`sum(case when statusPericia = 'pendente' then 1 else 0 end)`,
      periciasFeitas: sql<number>`sum(case when statusPericia = 'feita' then 1 else 0 end)`,
      semPericia: sql<number>`sum(case when statusPericia = 'sem_pericia' then 1 else 0 end)`,
    })
    .from(vehicles);

  return {
    totalNoPatio: stats?.totalNoPatio || 0,
    totalDevolvidos: stats?.totalDevolvidos || 0,
    periciasPendentes: stats?.periciasPendentes || 0,
    periciasFeitas: stats?.periciasFeitas || 0,
    semPericia: stats?.semPericia || 0,
    totalGeral: stats?.totalGeral || 0,
  };
}

export async function getAllVehiclesForExport(filters?: VehicleFilters): Promise<Vehicle[]> {
  const db = await getDb();
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
  
  return db.select().from(vehicles).where(whereClause).orderBy(desc(vehicles.createdAt));
}

// ========== AUDIT LOG OPERATIONS ==========

export async function createAuditLog(log: Omit<InsertAuditLog, "id" | "createdAt" | "reverted" | "revertedAt" | "revertedBy">): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(auditLogs).values(log);
  } catch (error) {
    logger.error("[AuditLog]", "Failed to create audit log:", error);
  }
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
  const db = await getDb();
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
  const db = await getDb();
  if (!db) return null;

  const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
  return log || null;
}

export async function markAuditLogReverted(id: number, revertedByUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(auditLogs).set({
    reverted: "sim",
    revertedAt: new Date(),
    revertedBy: revertedByUserId,
  }).where(eq(auditLogs.id, id));
}
