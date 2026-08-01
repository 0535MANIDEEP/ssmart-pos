const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = process.env.DATABASE_URL || 'file:./data/pos.db';

// Resolve the actual SQLite file path.
const dbFile = dbUrl.replace('file:', '');
const backendRoot = path.resolve(__dirname, '..', '..');
const resolvedDbPath = path.resolve(backendRoot, dbFile);

// Open raw handle FIRST and enable WAL mode — this affects the entire DB file
// so Prisma's adapter (which opens a separate connection) also benefits.
const rawDb = new Database(resolvedDbPath);
rawDb.pragma('journal_mode = WAL');      // Concurrent reads during writes, no "database is locked"
rawDb.pragma('busy_timeout = 5000');     // Wait up to 5s instead of failing immediately on lock
rawDb.pragma('synchronous = NORMAL');    // Good durability with WAL, faster writes
rawDb.pragma('cache_size = -64000');     // 64 MB page cache (negative = KB)

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
module.exports.rawDb = rawDb;
