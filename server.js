require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// DB se inicializa aquí (schema + seed en el require)
require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── RUTAS API ──────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/estudiantes',     require('./routes/estudiantes'));
app.use('/api/asistencias',     require('./routes/asistencias'));
app.use('/api/cursos',          require('./routes/cursos'));
app.use('/api/usuarios',        require('./routes/usuarios'));
app.use('/api/roles',           require('./routes/roles'));
app.use('/api/planificaciones', require('./routes/planificaciones'));
app.use('/api/periodos',        require('./routes/periodos'));
app.use('/api/reportes',        require('./routes/reportes'));
app.use('/api/backup',          require('./routes/backup'));

// ── BACKUP AUTOMÁTICO SEMANAL ─────────────────────────────────────────────────
{
  const { createBackupNow, backupDir, ensureBackupDir } = require('./utils/backup');
  const fs   = require('fs');
  const WEEK = 7 * 24 * 60 * 60 * 1000;

  const runWeeklyBackup = () => {
    try {
      const { filename } = createBackupNow();
      console.log(`✅ Backup automático: ${filename}`);
    } catch(e) {
      console.error('❌ Error en backup automático:', e.message);
    }
  };

  // Backup inicial si no existe ninguno (primer uso del sistema)
  setTimeout(() => {
    ensureBackupDir();
    const existing = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_'));
    if (existing.length === 0) runWeeklyBackup();
    // Luego semanal
    setInterval(runWeeklyBackup, WEEK);
  }, 8000); // 8 seg después del arranque, para no bloquear la inicialización
}

// ── SPA FALLBACK ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      console.error('sendFile error:', err.message, '| path:', indexPath);
      res.status(500).send('Error al servir la aplicación');
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n✅  EPM Sistema corriendo en http://localhost:${PORT}`);
  console.log(`    DB:      ${process.env.DB_PATH || './epm.db'}`);
  console.log(`    Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});
