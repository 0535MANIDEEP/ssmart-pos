const Database = require('better-sqlite3');
const db = new Database('D:/Projects/ssmart-pos/backend/data/pos.db');
const tables = ['Invoice', 'InvoiceItem', 'InvoicePayment', 'PurchaseInvoice', 'PurchaseItem', 'Return', 'ReturnItem', 'CustomerDuePayment'];
tables.forEach(t => {
  try {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    console.log(t + ':', cols.join(', '));
  } catch(e) { console.log(t + ': ERROR -', e.message.split('\n')[0]); }
});
db.close();
