require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── RUTAS API ──────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/instrumentos',    require('./routes/instrumentos'));
app.use('/api/estudiantes',     require('./routes/estudiantes'));
app.use('/api/asistencias',     require('./routes/asistencias'));
app.use('/api/cursos',          require('./routes/cursos'));
app.use('/api/usuarios',        require('./routes/usuarios'));
app.use('/api/roles',           require('./routes/roles'));
app.use('/api/planificaciones', require('./routes/planificaciones'));
app.use('/api/periodos',        require('./routes/periodos'));
app.use('/api/reportes',        require('./routes/reportes'));
app.use('/api/backup',          require('./routes/backup'));

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

// ── INICIALIZACIÓN ─────────────────────────────────────────────────────────────
async function init() {
  const db              = require('./db');
  const { runSchema }   = require('./db/schema');
  const { runSeed }     = require('./db/seed');
  const { IS_TURSO }    = require('./utils/backup');

  await runSchema(db);
  await runSeed(db);

  // Backup automático semanal solo en modo local (SQLite file)
  if (!IS_TURSO) {
    const { createBackupNow, backupDir, ensureBackupDir } = require('./utils/backup');
    const fs   = require('fs');
    const WEEK = 7 * 24 * 60 * 60 * 1000;

    const runWeeklyBackup = async () => {
      try {
        const { filename } = await createBackupNow();
        console.log(`✅ Backup automático: ${filename}`);
      } catch(e) {
        console.error('❌ Error en backup automático:', e.message);
      }
    };

    setTimeout(async () => {
      ensureBackupDir();
      const existing = fs.readdirSync(backupDir).filter(f => f.startsWith('backup_'));
      if (existing.length === 0) await runWeeklyBackup();
      setInterval(runWeeklyBackup, WEEK);
    }, 8000);
  }

  app.listen(PORT, () => {
    console.log(`\n✅  EPM Sistema corriendo en http://localhost:${PORT}`);
    console.log(`    DB:      ${process.env.TURSO_URL || 'file:./epm.db'}`);
    console.log(`    Entorno: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

init().catch(err => {
  console.error('❌ Error crítico en inicialización:', err);
  process.exit(1);
});
