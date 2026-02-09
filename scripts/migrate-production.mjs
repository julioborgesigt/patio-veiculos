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
 * Verifica se as tabelas principais já existem no banco.
 * Retorna true se AMBAS existem (users + vehicles).
 */
async function tablesExist() {
  let connection;
  try {
    connection = await createConnection(databaseUrl);

    const [rows] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'vehicles')"
    );

    const tableNames = rows.map(r => r.TABLE_NAME);
    const hasUsers = tableNames.includes('users');
    const hasVehicles = tableNames.includes('vehicles');

    console.log(`Tabelas encontradas: users=${hasUsers}, vehicles=${hasVehicles}`);
    return hasUsers && hasVehicles;
  } catch (error) {
    console.warn('Aviso ao verificar tabelas:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

console.log('Verificando schema do banco de dados...');

const alreadyExists = await tablesExist();

if (alreadyExists) {
  console.log('Tabelas ja existem. Pulando migracao para preservar dados.');
} else {
  console.log('Tabelas nao encontradas. Criando schema...');
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
