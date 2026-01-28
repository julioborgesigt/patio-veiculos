import { and, desc, eq, like, or, sql, asc, type Column } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  vehicles,
  InsertVehicle,
  Vehicle,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn("[Database]", "Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    logger.error("[Database]", "Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database]", "Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
