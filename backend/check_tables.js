const Database = require('better-sqlite3');
const db = new Database('D:/Projects/ssmart-pos/backend/data/pos.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
const cols = db.prepare('PRAGMA table_info(Product)').all();
console.log('Product columns:', cols.map(c => c.name).join(', '));
db.close();
