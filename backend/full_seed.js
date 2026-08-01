const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, 'data', 'pos.db'));
db.pragma('foreign_keys = ON');
const now = new Date().toISOString();
const fmt = (d = new Date()) => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };

const run = (sql, params) => { if (!params) return db.prepare(sql).run(); return db.prepare(sql).run(...params); };
const all = (sql, params) => { if (!params) return db.prepare(sql).all(); return db.prepare(sql).all(...params); };
const get = (sql, params) => { if (!params) return db.prepare(sql).get(); return db.prepare(sql).get(...params); };

// Clear existing transactional data
console.log('Clearing old transactional data...');
try { run('DELETE FROM InvoiceItem'); } catch(e){}
try { run('DELETE FROM InvoicePayment'); } catch(e){}
try { run('DELETE FROM Invoice'); } catch(e){}
try { run('DELETE FROM PurchaseItem'); } catch(e){}
try { run('DELETE FROM PurchaseInvoice'); } catch(e){}
try { run('DELETE FROM sqlite_sequence WHERE name IN ("Invoice","InvoiceItem","InvoicePayment","PurchaseInvoice","PurchaseItem")'); } catch(e){}
console.log('Done clearing');

// Lookups
const prods = all('SELECT id, barcode, name, sellingPrice, rateA, rateB, taxRate, unit FROM Product');
const prodByBar = {}; prods.forEach(p => { prodByBar[p.barcode] = p; });
const custs = all('SELECT id, name, phone FROM Customer');
const custByName = {}; custs.forEach(c => { custByName[c.name] = c; });
const sups = all('SELECT name, id FROM Supplier');
const supByName = {}; sups.forEach(s => { supByName[s.name] = s.id; });
const smens = all('SELECT name, id FROM Salesman');
const smByName = {}; smens.forEach(s => { smByName[s.name] = s.id; });

function p(barcode) { return prodByBar[barcode]; }
function cid(name) { return custByName[name] ? custByName[name].id : 0; }
function sid(name) { return supByName[name] || 0; }
function smid(name) { return smByName[name] || 0; }

let totalPOs = 0, totalPOAmt = 0;
let totalInvs = 0, totalInvAmt = 0;

// ═══════════════ PURCHASE INVOICES ═══════════════
console.log('\n--- Purchase Invoices ---');

function createPO(invoiceNo, supplierName, date, dueDate, status, paymentMethod, notes, items) {
  let subTotal = 0, taxTotal = 0;
  const dbItems = [];
  items.forEach(it => {
    const pr = p(it.barcode);
    if (!pr) { console.warn(`  SKIP: product not found ${it.barcode}`); return; }
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * pr.taxRate / 100);
    dbItems.push([pr.id, pr.name, it.qty, it.unitCost, null, 0, pr.taxRate, lineTax, lineTotal + lineTax, null, null]);
    subTotal += lineTotal;
    taxTotal += lineTax;
  });
  if (dbItems.length === 0) return;
  const totalAmount = Math.round(subTotal + taxTotal);
  totalPOAmt += totalAmount;

  const result = run(
    'INSERT INTO PurchaseInvoice (supplierId, invoiceNumber, date, dueDate, subtotal, discountType, discountAmount, taxAmount, totalAmount, amountPaid, status, paymentMethod, notes, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [sid(supplierName), invoiceNo, date, dueDate, Math.round(subTotal), null, 0, taxTotal, totalAmount, 0, status, paymentMethod, notes, 'admin', now, now]
  );
  if (result && result.lastInsertRowid) {
    const poId = result.lastInsertRowid;
    dbItems.forEach(item => run(
      'INSERT INTO PurchaseItem (purchaseInvoiceId, productId, name, quantity, unitCost, discountType, discountValue, taxRate, taxAmount, total, batchNumber, expiryDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [poId, ...item]
    ));
    totalPOs++;
    console.log(`  ${invoiceNo}: ₹${totalAmount} — ${supplierName} — ${items.length} items [${status}]`);
  }
}

createPO('PO-2026-001', 'RS Agro Trading', fmt(new Date(Date.now()-21*86400000)), fmt(new Date(Date.now()-21*86400000)), 'partial', 'CASH', 'Monthly rice & flour order', [
  { barcode:'8901234000001', qty:10, unitCost:40000 },
  { barcode:'8901234000003', qty:20, unitCost:3200 },
  { barcode:'8901234000007', qty:15, unitCost:3600 },
]);
createPO('PO-2026-002', 'Patel Dairy Farms', fmt(new Date(Date.now()-7*86400000)), fmt(new Date(Date.now()+7*86400000)), 'pending', null, 'Weekly dairy delivery', [
  { barcode:'8901234000009', qty:60, unitCost:650 },
  { barcode:'8901234000010', qty:100, unitCost:350 },
  { barcode:'8901234000013', qty:25, unitCost:2600 },
  { barcode:'8901234000014', qty:30, unitCost:450 },
]);
createPO('PO-2026-003', 'Beverages World', fmt(new Date(Date.now()-10*86400000)), fmt(new Date(Date.now()-10*86400000+15*86400000)), 'partial', 'UPI', 'Beverage stock replenishment', [
  { barcode:'8901234000017', qty:40, unitCost:450 },
  { barcode:'8901234000018', qty:35, unitCost:450 },
  { barcode:'8901234000022', qty:20, unitCost:1100 },
  { barcode:'8901234000023', qty:50, unitCost:1700 },
]);
createPO('PO-2026-004', 'Global Staples Ltd', fmt(new Date(Date.now()-21*86400000)), fmt(new Date(Date.now()-21*86400000)), 'paid', 'CASH', 'Snack category restock', [
  { barcode:'8901234000028', qty:60, unitCost:180 },
  { barcode:'8901234000030', qty:20, unitCost:1100 },
  { barcode:'8901234000034', qty:40, unitCost:230 },
  { barcode:'8901234000035', qty:12, unitCost:850 },
]);
createPO('PO-2026-005', 'RS Agro Trading', fmt(new Date(Date.now()-15*86400000)), fmt(new Date(Date.now()-15*86400000+15*86400000)), 'paid', 'UPI', 'Frozen foods order', [
  { barcode:'8901234000036', qty:12, unitCost:1600 },
  { barcode:'8901234000037', qty:15, unitCost:1000 },
  { barcode:'8901234000038', qty:10, unitCost:5500 },
]);
createPO('PO-2026-006', 'Clean Home Products', fmt(new Date(Date.now()-7*86400000)), fmt(new Date(Date.now()+7*86400000)), 'partial', 'CASH', 'Household supplies restock', [
  { barcode:'8901234000054', qty:20, unitCost:850 },
  { barcode:'8901234000056', qty:20, unitCost:600 },
  { barcode:'8901234000057', qty:25, unitCost:400 },
]);
createPO('PO-2026-007', 'Spice Route India', fmt(new Date(Date.now()-14*86400000)), fmt(new Date(Date.now()-14*86400000)), 'paid', 'CASH', 'Spice order', [
  { barcode:'8901234000070', qty:80, unitCost:70 },
  { barcode:'8901234000071', qty:50, unitCost:110 },
  { barcode:'8901234000073', qty:30, unitCost:140 },
  { barcode:'8901234000074', qty:25, unitCost:180 },
]);
createPO('PO-2026-008', 'Harvest Fresh Fruits', fmt(new Date(Date.now()-1*86400000)), fmt(new Date(Date.now()+7*86400000)), 'pending', null, 'Personal care restock', [
  { barcode:'8901234000059', qty:20, unitCost:2300 },
  { barcode:'8901234000060', qty:25, unitCost:1400 },
  { barcode:'8901234000062', qty:15, unitCost:1800 },
]);

// ═══════════════ SALES INVOICES ═══════════════
console.log('\n--- Sales Invoices ---');

function createINV(invoiceNo, custName, smName, date, paymentMethod, items) {
  const cidVal = cid(custName);
  const smidVal = smid(smName);
  const custPhone = custByName[custName] ? custByName[custName].phone : '';
  let subTotal = 0, taxTotal = 0;
  const invLineItems = [];
  items.forEach(it => {
    const pr = p(it.barcode);
    if (!pr) { console.warn(`  SKIP: product not found ${it.barcode}`); return; }
    const price = it.tier === 'A' ? pr.rateA : it.tier === 'C' ? (pr.rateC || pr.sellingPrice) : (pr.rateB || pr.sellingPrice);
    const lineTotal = price * it.qty;
    const lineTax = Math.round(lineTotal * pr.taxRate / 100);
    subTotal += lineTotal; taxTotal += lineTax;
    invLineItems.push([pr.id, pr.name, pr.unit, it.tier, it.qty, price, null, 0, pr.taxRate, lineTax, lineTotal + lineTax]);
  });
  if (invLineItems.length === 0) return;
  const totalAmount = Math.round(subTotal);
  const result = run(
    'INSERT INTO Invoice (invoiceNumber, customerId, customerName, customerPhone, salesmanId, subtotal, discountType, discountValue, discountAmount, taxAmount, loyaltyDiscount, totalAmount, paymentMethod, amountPaid, changeDue, dueAmount, previousDuePaid, returnValue, creditApplied, refundValue, refundMode, pointsRedeemed, pointsEarned, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [invoiceNo, cidVal, custName, custPhone, smidVal, Math.round(subTotal), null, 0, 0, taxTotal, 0, totalAmount, paymentMethod, 0, 0, totalAmount, 0, 0, 0, 0, null, 0, 0, date]
  );
  if (result && result.lastInsertRowid) {
    const invId = result.lastInsertRowid;
    invLineItems.forEach(itemData => run(
      'INSERT INTO InvoiceItem (invoiceId, productId, name, unit, rateTier, quantity, price, discountType, discountValue, taxRate, taxAmount, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [invId, ...itemData]
    ));
    const amountPaid = paymentMethod === 'CASH' ? totalAmount : Math.round(totalAmount * 0.5);
    const dueAmount = totalAmount - amountPaid;
    run('UPDATE Invoice SET amountPaid=?, dueAmount=? WHERE id=?', [amountPaid, dueAmount, invId]);
    run('INSERT INTO InvoicePayment (invoiceId, method, amount) VALUES (?,?,?)', [invId, paymentMethod, amountPaid]);
    totalInvs++;
    console.log(`  ${invoiceNo}: ₹${totalAmount} — ${custName} — ${paymentMethod} — ${amountPaid > 0 ? '₹'+amountPaid+' paid' : 'UNPAID'}`);
  }
}

createINV('INV-2026-101', 'Ram Lal', 'Rajesh Kumar', fmt(), 'CASH', [
  { barcode:'8901234000001', qty:2, tier:'B' },
  { barcode:'8901234000009', qty:2, tier:'B' },
  { barcode:'8901234000044', qty:1, tier:'B' },
]);
createINV('INV-2026-102', 'Sunita Devi', 'Priya Sharma', fmt(), 'UPI', [
  { barcode:'8901234000001', qty:10, tier:'A' },
  { barcode:'8901234000004', qty:5, tier:'A' },
  { barcode:'8901234000017', qty:20, tier:'A' },
]);
createINV('INV-2026-103', 'Ramesh Babu', 'Rajesh Kumar', fmt(), 'CASH', [
  { barcode:'8901234000028', qty:3, tier:'C' },
  { barcode:'8901234000030', qty:1, tier:'C' },
  { barcode:'8901234000051', qty:2, tier:'C' },
  { barcode:'8901234000064', qty:1, tier:'C' },
]);
createINV('INV-2026-104', 'Lakshmi Bai', 'Mohan Das', fmt(), 'UPI', [
  { barcode:'8901234000002', qty:5, tier:'B' },
  { barcode:'8901234000011', qty:2, tier:'B' },
  { barcode:'8901234000017', qty:10, tier:'B' },
  { barcode:'8901234000020', qty:5, tier:'B' },
]);
createINV('INV-2026-105', 'Krishna Murthy', 'Rajesh Kumar', fmt(), 'UPI', [
  { barcode:'8901234000001', qty:20, tier:'A' },
  { barcode:'8901234000002', qty:10, tier:'A' },
  { barcode:'8901234000009', qty:30, tier:'A' },
  { barcode:'8901234000013', qty:5, tier:'A' },
  { barcode:'8901234000023', qty:10, tier:'A' },
  { barcode:'8901234000045', qty:5, tier:'A' },
  { barcode:'8901234000064', qty:3, tier:'A' },
]);
createINV('INV-2026-106', 'Padmaja Garu', 'Priya Sharma', fmt(new Date(Date.now()-86400000)), 'CASH', [
  { barcode:'8901234000010', qty:6, tier:'B' },
  { barcode:'8901234000040', qty:2, tier:'B' },
  { barcode:'8901234000044', qty:1, tier:'B' },
  { barcode:'8901234000054', qty:1, tier:'B' },
]);
createINV('INV-2026-107', 'Suresh Reddy', 'Priya Sharma', fmt(new Date(Date.now()-86400000)), 'CASH', [
  { barcode:'8901234000034', qty:3, tier:'C' },
  { barcode:'8901234000028', qty:5, tier:'C' },
  { barcode:'8901234000078', qty:3, tier:'C' },
]);
createINV('INV-2026-108', 'Anitha K', 'Rajesh Kumar', fmt(), 'UPI', [
  { barcode:'8901234000009', qty:3, tier:'B' },
  { barcode:'8901234000014', qty:2, tier:'B' },
  { barcode:'8901234000046', qty:2, tier:'B' },
  { barcode:'8901234000054', qty:1, tier:'B' },
]);

// ═══════════════ DEDUCT STOCK FROM SALES ═══════════════
console.log('\n=== Deducting sales from stock ===');
const soldItems = all('SELECT productId, quantity FROM InvoiceItem');
let stockDeducted = 0;
soldItems.forEach(item => {
  run('UPDATE Product SET stock = MAX(0, stock - ?) WHERE id = ?', [item.quantity, item.productId]);
  stockDeducted++;
});
console.log(`Deducted ${stockDeducted} line items from stock`);

// ═══════════════ SUMMARY ═══════════════
const totalStock = get('SELECT COALESCE(SUM(stock),0) as s FROM Product').s;
const lowStock = get('SELECT COUNT(*) as c FROM Product WHERE stock <= 5').c;
const totalProd = get('SELECT COUNT(*) as c FROM Product').c;
const totalCust = get('SELECT COUNT(*) as c FROM Customer').c;
const totalSup = get('SELECT COUNT(*) as c FROM Supplier').c;
const totalSm = get('SELECT COUNT(*) as c FROM Salesman').c;
const finalPOs = get('SELECT COUNT(*) as c FROM PurchaseInvoice').c;
const finalInvs = get('SELECT COUNT(*) as c FROM Invoice').c;
const finalPI = get('SELECT COUNT(*) as c FROM PurchaseItem').c;
const finalII = get('SELECT COUNT(*) as c FROM InvoiceItem').c;
const finalPay = get('SELECT COUNT(*) as c FROM InvoicePayment').c;

console.log('\n=== FINAL SUMMARY ===');
console.log(`Purchase Invoices: ${finalPOs} (₹${Math.round(totalPOAmt)} total)`);
console.log(`  Purchase Items:  ${finalPI}`);
console.log(`Sales Invoices:   ${finalInvs} (₹${Math.round(totalInvAmt)} total)`);
console.log(`  Invoice Items:   ${finalII}`);
console.log(`  Payments:        ${finalPay}`);
console.log('');
console.log(`Products:          ${totalProd}`);
console.log(`Total stock:       ${totalStock}`);
console.log(`Low-stock (≤5):   ${lowStock}`);
console.log(`Customers:         ${totalCust}`);
console.log(`Suppliers:         ${totalSup}`);
console.log(`Salesmen:          ${totalSm}`);

console.log('\nOutstanding customer dues:');
const allCusts = all('SELECT id, name FROM Customer');
allCusts.forEach(c => {
  const dueInvs = all('SELECT invoiceNumber, dueAmount FROM Invoice WHERE customerId=? AND dueAmount > 0', [c.id]);
  const totalDue = dueInvs.reduce((s,i) => s + i.dueAmount, 0);
  if (totalDue > 0) console.log(`  ${c.name}: ₹${totalDue} due (${dueInvs.length} unpaid invoices)`);
});

console.log('\n=== Seed Complete ===');
db.close();
