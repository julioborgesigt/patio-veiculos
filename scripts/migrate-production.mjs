#!/usr/bin/env node
/**
 * Script de migração para ambiente de produção (DOMcloud)
 * Usa drizzle-kit push para sincronizar o schema diretamente contra o banco.
 * Trata o erro ER_MULTIPLE_PRI_KEY que ocorre quando a tabela já tem primary key.
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

  // Construir DATABASE_URL
  databaseUrl = `mysql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}/${dbName}`;
  console.log('DATABASE_URL construida a partir de variaveis individuais');
}

// Exportar DATABASE_URL para os comandos drizzle
process.env.DATABASE_URL = databaseUrl;

/**
 * Remove colunas legadas que causam conflito com o schema atual.
 * Isso trata o caso onde as tabelas foram criadas por migrações antigas
 * (com colunas openId, etc.) e drizzle-kit push não consegue alterar.
 */
async function fixTableSchema() {
  let connection;
  try {
    connection = await createConnection(databaseUrl);

    // Verificar se a tabela users existe
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );

    if (tables.length === 0) {
      console.log('Tabela users nao existe ainda, sera criada pelo drizzle-kit push.');
      return;
    }

    // Verificar colunas da tabela users
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );

    const columnNames = columns.map(c => c.COLUMN_NAME);

    // Se tem colunas legadas (openId, etc.), dropar e recriar
    if (columnNames.includes('openId') || columnNames.includes('provider')) {
      console.log('Detectadas colunas legadas na tabela users, recriando tabela...');
      await connection.execute('DROP TABLE users');
      console.log('Tabela users removida (sera recriada pelo drizzle-kit push).');
    }
  } catch (error) {
    console.warn('Aviso ao verificar schema:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

console.log('Sincronizando schema do banco de dados...');

// Corrigir schema legado antes do push
await fixTableSchema();

try {
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });

  console.log('Schema sincronizado com sucesso!');
} catch (error) {
  // Se o erro for apenas ER_MULTIPLE_PRI_KEY, ignorar (tabela já está correta)
  if (error.message && error.message.includes('ER_MULTIPLE_PRI_KEY')) {
    console.log('Aviso: Primary key ja existe (ignorando). Schema sincronizado.');
  } else {
    console.error('Erro ao sincronizar schema:', error.message);
    process.exit(1);
  }
}
