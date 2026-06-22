const { createClient } = require('@libsql/client');

const url       = process.env.TURSO_URL || 'file:./epm.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({ url, authToken });

// Flag accesible desde otros módulos para condicionar comportamiento file-only (ej: backup)
db.IS_TURSO = url.startsWith('libsql://') || url.startsWith('https://');

module.exports = db;
