// utils/backup.js — lógica compartida de backup
// FUTURO NUBE: reemplazar copyFileSync por upload a S3/GCS/Azure Blob
// pasando el destPath como parámetro o usando un stream.

const path = require('path');
const fs   = require('fs');

const backupDir = path.join(__dirname, '..', 'backups');

function getDbPath() {
  return path.resolve(process.env.DB_PATH || './epm.db');
}

function ensureBackupDir() {
  fs.mkdirSync(backupDir, { recursive: true });
}

function createBackupNow() {
  ensureBackupDir();

  // require lazy para evitar circular dep; db ya está inicializado cuando se llama
  const db = require('../db');
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch(e) {}

  const now      = new Date();
  const fecha    = now.toISOString().slice(0, 10);
  const hora     = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `backup_${fecha}_${hora}.db`;
  const destPath = path.join(backupDir, filename);

  fs.copyFileSync(getDbPath(), destPath);
  const stat = fs.statSync(destPath);
  return { filename, size: stat.size, destPath };
}

module.exports = { backupDir, getDbPath, ensureBackupDir, createBackupNow };
