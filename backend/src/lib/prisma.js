const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = process.env.DATABASE_URL || 'file:./data/pos.db';

// Resolve the actual SQLite file path. Prisma 7's config says "file:./data/pos.db"
// relative to the project root (backend/), so we resolve from the backend dir.
const dbFile = dbUrl.replace('file:', '');
const backendRoot = path.resolve(__dirname, '..', '..');
const resolvedDbPath = path.resolve(backendRoot, dbFile);

const adapter = new PrismaBetterSqlite3({ url: dbUrl });

const prisma = new PrismaClient({ adapter });

// Raw better-sqlite3 handle — needed by the backup API (db.backup()) which
// lives on the low-level Database object, not on PrismaClient.
const rawDb = new Database(resolvedDbPath);

module.exports = prisma;
module.exports.rawDb = rawDb;
