const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { runSchema } = require('./schema');
const { runSeed }   = require('./seed');

const dbPath = process.env.DB_PATH || './epm.db';
const db = new DatabaseSync(path.resolve(dbPath));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

runSchema(db);
runSeed(db);

module.exports = db;
