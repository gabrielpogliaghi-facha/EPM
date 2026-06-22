// utils/backup.js — lógica compartida de backup (solo modo local/SQLite)
// FUTURO NUBE: reemplazar copyFileSync por upload a S3/GCS/Azure Blob

const path = require('path');
const fs   = require('fs');

const backupDir = path.join(__dirname, '..', 'backups');
const IS_TURSO  = (process.env.TURSO_URL || '').startsWith('libsql://') ||
                  (process.env.TURSO_URL || '').startsWith('https://');

function getDbPath() {
  // En modo local, el archivo es epm.db (el TURSO_URL sería "file:./epm.db")
  const url = process.env.TURSO_URL || 'file:./epm.db';
  const filePart = url.startsWith('file:') ? url.slice(5) : './epm.db';
  return path.resolve(filePart);
}

function ensureBackupDir() {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function createBackupNow() {
  if (IS_TURSO) throw new Error('Backup de archivos no disponible en modo nube (Turso). Usá el panel de Turso para exportar datos.');

  ensureBackupDir();

  const db = require('../db');
  try { await db.execute('PRAGMA wal_checkpoint(TRUNCATE)'); } catch(e) {}

  const now      = new Date();
  const fecha    = now.toISOString().slice(0, 10);
  const hora     = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `backup_${fecha}_${hora}.db`;
  const destPath = path.join(backupDir, filename);

  fs.copyFileSync(getDbPath(), destPath);
  const stat = fs.statSync(destPath);
  return { filename, size: stat.size, destPath };
}

module.exports = { backupDir, getDbPath, ensureBackupDir, createBackupNow, IS_TURSO };
