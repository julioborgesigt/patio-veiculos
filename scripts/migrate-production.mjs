#!/usr/bin/env node
/**
 * Script de migração para ambiente de produção (DOMcloud)
 * Só cria as tabelas se elas não existirem. Nunca dropa tabelas existentes.
 */

import { execSync } from 'child_process';
import { createConnection } from 'mysql2/promise';

// Tentar usar DATABASE_URL diretamente primeiro
let databaseUrl = process.env.DATABASE_URL;

// Se não existir, construir a partir de variáveis individuais
if (!databaseUrl) {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME;

  if (!dbUser || !dbPassword || !dbName) {
    console.error('Erro: Credenciais do banco de dados nao configuradas!');
    console.error('Configure DATABASE_URL ou DB_USER, DB_PASSWORD e DB_NAME');
    process.exit(1);
  }

  databaseUrl = `mysql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}/${dbName}`;
  console.log('DATABASE_URL construida a partir de variaveis individuais');
}

process.env.DATABASE_URL = databaseUrl;

/**
 * Verifica quais tabelas existem no banco.
 * Retorna objeto com status de cada tabela.
 */
async function checkTables() {
  let connection;
  try {
    connection = await createConnection(databaseUrl);

    const [rows] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'vehicles', 'audit_logs')"
    );

    const tableNames = rows.map(r => r.TABLE_NAME);
    const result = {
      users: tableNames.includes('users'),
      vehicles: tableNames.includes('vehicles'),
      audit_logs: tableNames.includes('audit_logs'),
    };

    console.log(`Tabelas encontradas: users=${result.users}, vehicles=${result.vehicles}, audit_logs=${result.audit_logs}`);
    return result;
  } catch (error) {
    console.warn('Aviso ao verificar tabelas:', error.message);
    return { users: false, vehicles: false, audit_logs: false };
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Cria a tabela audit_logs manualmente via SQL (preserva tabelas existentes).
 */
async function createAuditLogsTable() {
  let connection;
  try {
    connection = await createConnection(databaseUrl);
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id int AUTO_INCREMENT PRIMARY KEY,
        userId int NOT NULL,
        username varchar(64) NOT NULL,
        action enum('criar_veiculo','editar_veiculo','excluir_veiculo','marcar_pericia','reverter_pericia','marcar_devolvido','desfazer_devolucao','login') NOT NULL,
        entityType enum('vehicle','user') NOT NULL DEFAULT 'vehicle',
        entityId int,
        description varchar(500) NOT NULL,
        previousData json,
        newData json,
        reverted enum('sim','nao') NOT NULL DEFAULT 'nao',
        revertedAt timestamp NULL,
        revertedBy int,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_user (userId),
        INDEX idx_audit_action (action),
        INDEX idx_audit_entity (entityType, entityId),
        INDEX idx_audit_created (createdAt)
      )
    `);
    console.log('Tabela audit_logs criada com sucesso!');
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('Tabela audit_logs ja existe.');
    } else {
      console.error('Erro ao criar audit_logs:', error.message);
    }
  } finally {
    if (connection) await connection.end();
  }
}

console.log('Verificando schema do banco de dados...');

const tables = await checkTables();

if (tables.users && tables.vehicles) {
  console.log('Tabelas principais ja existem. Pulando migracao para preservar dados.');

  // Criar tabela audit_logs se nao existir (nova feature)
  if (!tables.audit_logs) {
    console.log('Criando tabela audit_logs...');
    await createAuditLogsTable();
  }
} else {
  console.log('Tabelas nao encontradas. Criando schema completo...');
  try {
    execSync('npx drizzle-kit push --force', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
    console.log('Schema criado com sucesso!');
  } catch (error) {
    if (error.message && error.message.includes('ER_MULTIPLE_PRI_KEY')) {
      console.log('Aviso: Primary key ja existe (ignorando). Schema criado.');
    } else {
      console.error('Erro ao criar schema:', error.message);
      process.exit(1);
    }
  }
}
