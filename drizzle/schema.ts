import {
  int,
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
