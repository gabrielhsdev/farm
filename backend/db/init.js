/**
 * Inicializa o banco do zero: apaga o arquivo se existir, cria novo,
 * executa schema.sql e seeds.sql.
 *
 * Uso: npm run db:init
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const dbAbs = path.resolve(__dirname, '..', DB_PATH);

// Apaga o banco anterior (e arquivos auxiliares do WAL) se existir
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const f = dbAbs + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`  removido: ${path.basename(f)}`);
  }
}

const schemaPath = path.join(__dirname, 'schema.sql');
const seedsPath  = path.join(__dirname, 'seeds.sql');

const schema = fs.readFileSync(schemaPath, 'utf8');
const seeds  = fs.readFileSync(seedsPath, 'utf8');

const db = new Database(dbAbs);
db.pragma('foreign_keys = ON');

console.log('aplicando schema.sql...');
db.exec(schema);
console.log('aplicando seeds.sql...');
db.exec(seeds);

const cats = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
const fps  = db.prepare('SELECT COUNT(*) AS n FROM formas_pagamento').get().n;

db.close();

console.log(`\n  banco criado em: ${dbAbs}`);
console.log(`  categorias: ${cats}`);
console.log(`  formas de pagamento: ${fps}`);
console.log('OK');
