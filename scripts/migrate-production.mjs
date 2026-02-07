#!/usr/bin/env node
/**
 * Script de migração para ambiente de produção (DOMcloud)
 * Este script constrói a DATABASE_URL a partir de variáveis individuais
 * quando a DATABASE_URL completa não está disponível
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
    console.error('❌ Erro: Credenciais do banco de dados não configuradas!');
    console.error('Configure DATABASE_URL ou DB_USER, DB_PASSWORD e DB_NAME');
    process.exit(1);
  }

  // Construir DATABASE_URL
  databaseUrl = `mysql://${dbUser}:${dbPassword}@${dbHost}/${dbName}`;
  console.log('✅ DATABASE_URL construída a partir de variáveis individuais');
}

// Exportar DATABASE_URL para os comandos drizzle
process.env.DATABASE_URL = databaseUrl;

console.log('🔄 Executando migrações do banco de dados...');

try {
  // Executar drizzle-kit generate
  console.log('📝 Gerando migrações...');
  execSync('drizzle-kit generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });

  // Executar drizzle-kit migrate
  console.log('🚀 Aplicando migrações...');
  execSync('drizzle-kit migrate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });

  console.log('✅ Migrações concluídas com sucesso!');
} catch (error) {
  console.error('❌ Erro ao executar migrações:', error.message);
  process.exit(1);
}
