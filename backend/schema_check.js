const Database = require('better-sqlite3');
const db = new Database('D:/Projects/ssmart-pos/backend/data/pos.db');
console.log('Salesman:', db.prepare('PRAGMA table_info(Salesman)').all().map(c => c.name).join(', '));
console.log('Customer:', db.prepare('PRAGMA table_info(Customer)').all().map(c => c.name).join(', '));
console.log('Product:', db.prepare('PRAGMA table_info(Product)').all().map(c => c.name).join(', '));
console.log('Supplier:', db.prepare('PRAGMA table_info(Supplier)').all().map(c => c.name).join(', '));
db.close();
