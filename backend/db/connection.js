/**
 * Conexão única e reutilizável com o SQLite.
 * better-sqlite3 é síncrono e suficiente para a Fase 2.
 */
require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const dbAbs = path.resolve(__dirname, '..', DB_PATH);

const db = new Database(dbAbs);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
