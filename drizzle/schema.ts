import {
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  password: varchar("password", { length: 256 }).notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de veículos apreendidos no pátio.
 * Suporta duas placas (original e ostentada para casos de clonagem),
 * controle de perícia e devolução, e campos de procedimento/processo.
 */
export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),

    // Placas - suporte a duas placas para veículos clonados
    placaOriginal: varchar("placaOriginal", { length: 10 }),
    placaOstentada: varchar("placaOstentada", { length: 10 }),

    // Identificação do veículo
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
    // Formato procedimento: xxx-xxxxx/ano (ex: 001-00001/2024)
    numeroProcedimento: varchar("numeroProcedimento", { length: 20 }),
    // Formato processo: xxxxxxx-xx.xxxx.x.xx.xxxx (ex: 0000001-00.2024.8.26.0001)
    numeroProcesso: varchar("numeroProcesso", { length: 30 }),

    // Observações com limite de 200 caracteres
    observacoes: varchar("observacoes", { length: 200 }),

    // Status de perícia: pendente, sem_pericia, feita
    statusPericia: mysqlEnum("statusPericia", [
      "pendente",
      "sem_pericia",
      "feita",
    ])
      .default("pendente")
      .notNull(),

    // Status de devolução
    devolvido: mysqlEnum("devolvido", ["sim", "nao"]).default("nao").notNull(),
    dataDevolucao: timestamp("dataDevolucao"),

    // Metadados
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),

    // Usuário que cadastrou
    createdBy: int("createdBy"),
  },
  (table) => [
    // Índices para melhor performance em buscas frequentes
    index("idx_placa_original").on(table.placaOriginal),
    index("idx_placa_ostentada").on(table.placaOstentada),
    index("idx_status").on(table.devolvido, table.statusPericia),
    index("idx_created_at").on(table.createdAt),
    index("idx_numero_processo").on(table.numeroProcesso),
    index("idx_numero_procedimento").on(table.numeroProcedimento),
  ]
);

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * Tabela de logs de auditoria.
 * Registra todas as ações realizadas no sistema com possibilidade de reversão.
 */
export const auditLogs = mysqlTable(
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

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_user").on(table.userId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_entity").on(table.entityType, table.entityId),
    index("idx_audit_created").on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
