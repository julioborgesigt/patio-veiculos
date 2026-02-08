#!/usr/bin/env node
/**
 * Script de migração para ambiente de produção (DOMcloud)
 * Usa drizzle-kit push para sincronizar o schema diretamente contra o banco
 */

import { execSync } from 'child_process';

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
  databaseUrl = `mysql://${dbUser}:${dbPassword}@${dbHost}/${dbName}`;
  console.log('DATABASE_URL construida a partir de variaveis individuais');
}

// Exportar DATABASE_URL para os comandos drizzle
process.env.DATABASE_URL = databaseUrl;

console.log('Sincronizando schema do banco de dados...');

try {
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });

  console.log('Schema sincronizado com sucesso!');
} catch (error) {
  console.error('Erro ao sincronizar schema:', error.message);
  process.exit(1);
}
