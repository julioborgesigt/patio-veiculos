#!/usr/bin/env node
/**
 * Script para criar o usuário admin no deploy.
 * Usa ADMIN_USER e ADMIN_PASSWORD das variáveis de ambiente.
 * Também requer DATABASE_URL (ou DB_USER, DB_PASSWORD, DB_NAME).
 */

import { createConnection } from 'mysql2/promise';
import { scryptSync, randomBytes } from 'crypto';

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME;

  if (!dbUser || !dbPassword || !dbName) {
    return null;
  }

  return `mysql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}/${dbName}`;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seedAdmin() {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.log('ADMIN_PASSWORD nao configurado, pulando criacao do admin.');
    return;
  }

  const url = buildDatabaseUrl();
  if (!url) {
    console.error('Erro: Credenciais do banco de dados nao configuradas!');
    console.error('Configure DATABASE_URL ou DB_USER, DB_PASSWORD e DB_NAME');
    process.exit(1);
  }

  const connection = await createConnection(url);

  try {
    // Verificar se o admin já existe
    const [rows] = await connection.execute(
      'SELECT id, username FROM users WHERE username = ?',
      [adminUser]
    );

    if (rows.length > 0) {
      console.log(`Usuario '${adminUser}' ja existe (id=${rows[0].id}), pulando criacao.`);
      return;
    }

    // Criar o admin
    const hashedPassword = hashPassword(adminPassword);
    await connection.execute(
      'INSERT INTO users (username, password, name, role, createdAt, updatedAt, lastSignedIn) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())',
      [adminUser, hashedPassword, 'Administrador', 'admin']
    );

    console.log(`Usuario admin '${adminUser}' criado com sucesso!`);
  } finally {
    await connection.end();
  }
}

seedAdmin().catch(err => {
  console.error('Erro ao criar usuario admin:', err.message);
  process.exit(1);
});
