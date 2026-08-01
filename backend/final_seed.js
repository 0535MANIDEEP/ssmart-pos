const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, 'data', 'pos.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const now = new Date().toISOString();
const fmt = (d = new Date()) => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };

function q(sql, params) { const stmt = params ? db.prepare(sql).run(...params) : db.prepare(sql).run(); return stmt; }
function a(sql, params) { const rows = params ? db.prepare(sql).all(...params) : db.prepare(sql).all(); return rows; }
function g(sql, params) { const row = params ? db.prepare(sql).get(...params) : db.prepare(sql).get(); return row; }

// Clear transactional data
['InvoiceItem','InvoicePayment','Invoice','PurchaseItem','PurchaseInvoice','ReturnItem','Return','CustomerDuePayment'].forEach(t => { try { q(`DELETE FROM ${t}`); } catch(e){} });
console.log('Cleared transactional data');

// Lookups
const prods = a('SELECT id, barcode, name, sellingPrice, purchasePrice, taxRate FROM Product');
const prodB = {}; prods.forEach(p => { prodB[p.barcode] = p; });
const custs = a('SELECT id, name, phone FROM Customer');
const custC = {}; custs.forEach(c => { custC[c.name] = c; });
const sups = a('SELECT id, name FROM Supplier');
const supID = {}; sups.forEach(s => { supID[s.name] = s.id; });
const smen = a('SELECT id, name FROM Salesman');
const smID = {}; smen.forEach(s => { smID[s.name] = s.id; });

function p(barcode) { return prodB[barcode]; }
function pid(name) { return custC[name] ? custC[name].id : 0; }
function sid(name) { return supID[name] || 0; }
function smid(name) { return smID[name] || 0; }

let poN = 0, invN = 0, piN = 0, iiN = 0, payN = 0;
let totalPurchaseAmt = 0, totalSalesAmt = 0;

// ═══════════ PURCHASES ═══════════
console.log('\n--- Purchase Invoices ---');

function createPO(invoiceNo, supplierName, date, dueDate, status, paymentMethod, notes, items) {
  let subTotal = 0, taxTotal = 0;
  const dbItems = [];
  items.forEach(it => {
    const pr = p(it.barcode);
    if (!pr) { console.warn(`  Product not found: ${it.barcode}`); return; }
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * pr.taxRate / 100);
    dbItems.push([poN + 1, pr.id, pr.name, it.qty, it.unitCost, null, 0, pr.taxRate, lineTax, lineTotal + lineTax, null, null]);
    subTotal += lineTotal; taxTotal += lineTax;
  });
  const totalAmount = Math.round(subTotal + taxTotal);
  totalPurchaseAmt += totalAmount;
  const r = q('INSERT INTO PurchaseInvoice (supplierId, invoiceNumber, date, dueDate, subtotal, discountType, discountAmount, taxAmount, totalAmount, amountPaid, status, paymentMethod, notes, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [sid(supplierName), invoiceNo, date, dueDate, Math.round(subTotal), null, 0, taxTotal, totalAmount, 0, status, paymentMethod, notes, 'admin', now, now]);
  if (r && r.lastInsertRowid) {
    poN = r.lastInsertRowid;
    dbItems.forEach(item => { q('INSERT INTO PurchaseItem (purchaseInvoiceId, productId, name, quantity, unitCost, discountType, discountValue, taxRate, taxAmount, total, batchNumber, expiryDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', item); piN++; });
    console.log(`  ${invoiceNo}: ₹${totalAmount} — ${supplierName} — ${items.length} items [${status}]`);
  }
}

createPO('PO-2026-001', 'RS Agro Trading', fmt(new Date(Date.now()-21*86400000)), fmt(new Date(Date.now()-21*86400000)), 'partial', 'CASH', 'Monthly rice & flour order', [
  { barcode:'8901234000001', qty:10, unitCost:40000 }, { barcode:'8901234000003', qty:20, unitCost:3200 }, { barcode:'8901234000007', qty:15, unitCost:3600 },
]);
createPO('PO-2026-002', 'Patel Dairy Farms', fmt(new Date(Date.now()-7*86400000)), fmt(new Date(Date.now()+7*86400000)), 'pending', null, 'Weekly dairy delivery', [
  { barcode:'8901234000009', qty:60, unitCost:650 }, { barcode:'8901234000010', qty:100, unitCost:350 }, { barcode:'8901234000013', qty:25, unitCost:2600 }, { barcode:'8901234000014', qty:30, unitCost:450 },
]);
createPO('PO-2026-003', 'Beverages World', fmt(new Date(Date.now()-10*86400000)), fmt(new Date(Date.now()-10*86400000+15*86400000)), 'partial', 'UPI', 'Beverage stock replenishment', [
  { barcode:'8901234000017', qty:40, unitCost:450 }, { barcode:'8901234000018', qty:35, unitCost:450 }, { barcode:'8901234000022', qty:20, unitCost:1100 }, { barcode:'8901234000023', qty:50, unitCost:1700 },
]);
createPO('PO-2026-004', 'Global Staples Ltd', fmt(new Date(Date.now()-21*86400000)), fmt(new Date(Date.now()-21*86400000)), 'paid', 'CASH', 'Snack category restock', [
  { barcode:'8901234000028', qty:60, unitCost:180 }, { barcode:'8901234000030', qty:20, unitCost:1100 }, { barcode:'8901234000034', qty:40, unitCost:230 }, { barcode:'8901234000035', qty:12, unitCost:850 },
]);
createPO('PO-2026-005', 'RS Agro Trading', fmt(new Date(Date.now()-15*86400000)), fmt(new Date(Date.now()-15*86400000+15*86400000)), 'paid', 'UPI', 'Frozen foods order', [
  { barcode:'8901234000036', qty:12, unitCost:1600 }, { barcode:'8901234000037', qty:15, unitCost:1000 }, { barcode:'8901234000038', qty:10, unitCost:5500 },
]);
createPO('PO-2026-006', 'Clean Home Products', fmt(new Date(Date.now()-7*86400000)), fmt(new Date(Date.now()+7*86400000)), 'partial', 'CASH', 'Household supplies restock', [
  { barcode:'8901234000054', qty:20, unitCost:850 }, { barcode:'8901234000056', qty:20, unitCost:600 }, { barcode:'8901234000057', qty:25, unitCost:400 },
]);
createPO('PO-2026-007', 'Spice Route India', fmt(new Date(Date.now()-14*86400000)), fmt(new Date(Date.now()-14*86400000)), 'paid', 'CASH', 'Spice order', [
  { barcode:'8901234000070', qty:80, unitCost:70 }, { barcode:'8901234000071', qty:50, unitCost:110 }, { barcode:'8901234000073', qty:30, unitCost:140 }, { barcode:'8901234000074', qty:25, unitCost:180 },
]);
createPO('PO-2026-008', 'Harvest Fresh Fruits', fmt(new Date(Date.now()-1*86400000)), fmt(new Date(Date.now()+7*86400000)), 'pending', null, 'Personal care restock', [
  { barcode:'8901234000059', qty:20, unitCost:2300 }, { barcode:'8901234000060', qty:25, unitCost:1400 }, { barcode:'8901234000062', qty:15, unitCost:1800 },
]);

// ═══════════ SALES ═══════════
console.log('\n--- Sales Invoices ---');

function createINV(invoiceNo, custName, smName, date, paymentMethod, items) {
  let subTotal = 0, taxTotal = 0;
  const dbItems = [];
  items.forEach(it => {
    const pr = p(it.barcode);
    if (!pr) { console.warn(`  Product not found: ${it.barcode}`); return; }
    const price = it.tier === 'A' ? pr.rateA : it.tier === 'C' ? (pr.rateC || pr.sellingPrice) : (pr.rateB || pr.sellingPrice);
    const lineTotal = price * it.qty;
    const lineTax = Math.round(lineTotal * pr.taxRate / 100);
    subTotal += lineTotal; taxTotal += lineTax;
    dbItems.push([null, invoiceNo, pr.id, pr.name, pr.unit, it.tier, it.qty, price, it.discountType || null, it.discountValue || 0, pr.taxRate, lineTax, lineTotal + lineTax]);
  });
  const totalAmount = Math.round(subTotal + taxTotal);
  totalSalesAmt += totalAmount;
  const amountPaid = paymentMethod === 'CASH' ? totalAmount : Math.round(totalAmount * 0.5);
  const dueAmount = totalAmount - amountPaid;
  const r = q('INSERT INTO Invoice (invoiceNumber, customerId, customerName, customerPhone, salesmanId, subtotal, discountType, discountValue, discountAmount, taxAmount, loyaltyDiscount, totalAmount, paymentMethod, amountPaid, changeDue, dueAmount, previousDuePaid, returnValue, creditApplied, refundValue, refundMode, pointsRedeemed, pointsEarned, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [invoiceNo, pid(custName), custName, custC[custName].phone, smid(smName), Math.round(subTotal), null, 0, 0, taxTotal, 0, totalAmount, paymentMethod, amountPaid, 0, dueAmount, 0, 0, 0, 0, null, 0, 0, date]);
  if (r && r.lastInsertRowid) {
    invN = r.lastInsertRowid;
    dbItems.forEach(item => { q('INSERT INTO InvoiceItem (invoiceId, productId, name, unit, rateTier, quantity, price, discountType, discountValue, taxRate, taxAmount, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', item); iiN++; });
    q('INSERT INTO InvoicePayment (invoiceId, method, amount) VALUES (?,?,?)', [invN, paymentMethod, amountPaid]); payN++;
    console.log(`  ${invoiceNo}: ₹${totalAmount} — ${custName} — ${paymentMethod} — ${amountPaid > 0 ? 'PAID' : 'DUE'}`);
  }
}

createINV('INV-2026-101', 'Ram Lal', 'Rajesh Kumar', fmt(), 'CASH', [
  { barcode:'8901234000001', qty:2, tier:'B' }, { barcode:'8901234000009', qty:2, tier:'B' }, { barcode:'8901234000044', qty:1, tier:'B' },
]);
createINV('INV-2026-102', 'Sunita Devi', 'Priya Sharma', fmt(), 'UPI', [
  { barcode:'8901234000001', qty:10, tier:'A' }, { barcode:'8901234000004', qty:5, tier:'A' }, { barcode:'8901234000017', qty:20, tier:'A' },
]);
createINV('INV-2026-103', 'Ramesh Babu', 'Rajesh Kumar', fmt(), 'CASH', [
  { barcode:'8901234000028', qty:3, tier:'C' }, { barcode:'8901234000030', qty:1, tier:'C' }, { barcode:'8901234000051', qty:2, tier:'C' }, { barcode:'8901234000064', qty:1, tier:'C' },
]);
createINV('INV-2026-104', 'Lakshmi Bai', 'Mohan Das', fmt(), 'UPI', [
  { barcode:'8901234000002', qty:5, tier:'B' }, { barcode:'8901234000011', qty:2, tier:'B' }, { barcode:'8901234000017', qty:10, tier:'B' }, { barcode:'8901234000020', qty:5, tier:'B' },
]);
createINV('INV-2026-105', 'Krishna Murthy', 'Rajesh Kumar', fmt(), 'UPI', [
  { barcode:'8901234000001', qty:20, tier:'A' }, { barcode:'8901234000002', qty:10, tier:'A' }, { barcode:'8901234000009', qty:30, tier:'A' }, { barcode:'8901234000013', qty:5, tier:'A' }, { barcode:'8901234000023', qty:10, tier:'A' }, { barcode:'8901234000045', qty:5, tier:'A' }, { barcode:'8901234000064', qty:3, tier:'A' },
]);
createINV('INV-2026-106', 'Padmaja Garu', 'Priya Sharma', fmt(new Date(Date.now()-86400000)), 'CASH', [
  { barcode:'8901234000010', qty:6, tier:'B' }, { barcode:'8901234000040', qty:2, tier:'B' }, { barcode:'8901234000044', qty:1, tier:'B' }, { barcode:'8901234000054', qty:1, tier:'B' },
]);
createINV('INV-2026-107', 'Suresh Reddy', 'Priya Sharma', fmt(new Date(Date.now()-86400000)), 'CASH', [
  { barcode:'8901234000034', qty:3, tier:'C' }, { barcode:'8901234000028', qty:5, tier:'C' }, { barcode:'8901234000078', qty:3, tier:'C' },
]);
createINV('INV-2026-108', 'Anitha K', 'Rajesh Kumar', fmt(), 'UPI', [
  { barcode:'8901234000009', qty:3, tier:'B' }, { barcode:'8901234000014', qty:2, tier:'B' }, { barcode:'8901234000046', qty:2, tier:'B' }, { barcode:'8901234000054', qty:1, tier:'B' },
]);

// ═══════════ UPDATE STOCK ═══════════
console.log('\n=== Deducting sales from stock ===');
const sold = a('SELECT productId, quantity FROM InvoiceItem');
sold.forEach(item => { q('UPDATE Product SET stock = MAX(0, stock - ?) WHERE id = ?', [item.quantity, item.productId]); });
console.log(`Deducted ${sold.length} line items from stock`);

// ═══════════ SUMMARY ═══════════
const totalPO = g('SELECT COUNT(*) as c FROM PurchaseInvoice').c;
const totalINV = g('SELECT COUNT(*) as c FROM Invoice').c;
const totalPI = g('SELECT COUNT(*) as c FROM PurchaseItem').c;
const totalII = g('SELECT COUNT(*) as c FROM InvoiceItem').c;
const totalPay = g('SELECT COUNT(*) as c FROM InvoicePayment').c;
const totalStock = g('SELECT SUM(stock) as s FROM Product').s;
const lowStock = g('SELECT COUNT(*) as c FROM Product WHERE stock <= 5').c;
const totalProd = g('SELECT COUNT(*) as c FROM Product').c;

console.log('\n=== FINAL SUMMARY ===');
console.log(`Purchase Invoices: ${totalPO} (₹${Math.round(totalPurchaseAmt)} total)`);
console.log(`  Purchase Items: ${totalPI}`);
console.log(`Sales Invoices:   ${totalINV} (₹${Math.round(totalSalesAmt)} total)`);
console.log(`  Invoice Items:   ${totalII}`);
console.log(`  Payments:        ${totalPay}`);
console.log('');
console.log(`Products:          ${totalProd}`);
console.log(`Total stock:       ${totalStock}`);
console.log(`Low-stock (≤5):    ${lowStock}`);
console.log(`Customers:         ${custs.length}`);
console.log(`Suppliers:         ${sups.length}`);
console.log(`Salesmen:          ${smen.length}`);
console.log('\nOutstanding dues:');
custs.forEach(c => {
  const dueInvoices = a('SELECT invoiceNumber, dueAmount FROM Invoice WHERE customerId=? AND dueAmount > 0', [c.id]);
  const totalDue = dueInvoices.reduce((s,i) => s + i.dueAmount, 0);
  if (totalDue > 0) console.log(`  ${c.name}: ₹${totalDue} due (${dueInvoices.length} invoices)`);
});

db.close();
