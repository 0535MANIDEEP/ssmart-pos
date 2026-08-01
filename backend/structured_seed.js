const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, 'data', 'pos.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
const now = new Date();
const ts = (d = now) => d.toISOString();
const fmt = (d = now) => { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };

function run(sql, params) { try { return db.prepare(sql).run(params); } catch(e) { console.error('SQL error:', e.message.split('\n')[0]); return null; } }
function all(sql, params) { try { return db.prepare(sql).all(params); } catch(e) { return []; } }
function get(sql, params) { try { return db.prepare(sql).get(params); } catch(e) { return null; } }

// ── Clear all transactional data (keep products/customers/suppliers/salesmen/shop) ──
['InvoiceItem', 'InvoicePayment', 'Invoice', 'PurchaseItem', 'PurchaseInvoice', 'ReturnItem', 'Return', 'CustomerDuePayment', 'JournalLine', 'Journal', 'LedgerLine', 'Ledger', 'LedgerBalance'].forEach(t => {
  try { run(`DELETE FROM ${t}`); } catch(e) {}
});
try { run(`DELETE FROM sqlite_sequence WHERE name IN ('Invoice','InvoiceItem','InvoicePayment','PurchaseInvoice','PurchaseItem','Return','ReturnItem','CustomerDuePayment')`); } catch(e) {}
console.log('Cleared transactional data');

// ── Verify existing base data ──
const existingProds = get('SELECT COUNT(*) as c FROM Product').c;
const existingCusts = get('SELECT COUNT(*) as c FROM Customer').c;
const existingSups = get('SELECT COUNT(*) as c FROM Supplier').c;
console.log(`Existing: ${existingProds} products, ${existingCusts} customers, ${existingSups} suppliers`);

if (existingProds < 50) { console.error('Not enough products seeded!'); db.close(); process.exit(1); }

// ── Update product stock to proper levels (simulating current inventory after purchases) ──
// These are the CURRENT stock levels as if purchases were already received
const stockUpdates = [
  // Rice & Flour
  { barcode: '8901234000001', stock: 25 },  // Basmati Rice 5kg
  { barcode: '8901234000002', stock: 40 },  // Basmati Rice 1kg
  { barcode: '8901234000003', stock: 60 },  // Wheat Flour 1kg
  { barcode: '8901234000007', stock: 50 },  // Atta 1kg
  { barcode: '8901234000008', stock: 15 },  // Sooji 1kg
  // Pulses & Grains
  { barcode: '8901234000004', stock: 30 },  // Toor Dal 1kg
  { barcode: '8901234000005', stock: 20 },  // Moong Dal 1kg
  { barcode: '8901234000006', stock: 35 },  // Chana Dal 1kg
  // Dairy & Eggs
  { barcode: '8901234000009', stock: 40 },  // Amul Milk 1L
  { barcode: '8901234000010', stock: 50 },  // Amul Milk 500ml
  { barcode: '8901234000011', stock: 15 },  // Amul Butter 500g
  { barcode: '8901234000012', stock: 12 },  // Amul Ghee 1L
  { barcode: '8901234000013', stock: 20 },  // Eggs 30pcs
  { barcode: '8901234000014', stock: 30 },  // Curd 1L
  { barcode: '8901234000015', stock: 10 },  // Paneer 200g
  { barcode: '8901234000016', stock: 8 },   // Amul Cheese Slices
  // Beverages
  { barcode: '8901234000017', stock: 35 },  // Coca Cola 1.25L
  { barcode: '8901234000018', stock: 30 },  // Pepsi 1.25L
  { barcode: '8901234000019', stock: 20 },  // Thumbs Up 1L
  { barcode: '8901234000020', stock: 25 },  // Frooti 1L
  { barcode: '8901234000021', stock: 10 },  // Nescafe 200g
  { barcode: '8901234000022', stock: 15 },  // Red Bull 250ml
  { barcode: '8901234000023', stock: 40 },  // Bisleri 1L
  { barcode: '8901234000024', stock: 12 },  // Mineral Water case
  { barcode: '8901234000025', stock: 25 },  // Good Day 200ml
  { barcode: '8901234000026', stock: 18 },  // Tata Tea 250g
  { barcode: '8901234000027', stock: 45 },  // Amul Fresh 500ml
  // Snacks
  { barcode: '8901234000028', stock: 50 },  // Lays 40g
  { barcode: '8901234000029', stock: 30 },  // Uncle Chips 80g
  { barcode: '8901234000030', stock: 15 },  // Haldiram Bhujia
  { barcode: '8901234000031', stock: 12 },  // Bikaji Bhujia
  { barcode: '8901234000032', stock: 20 },  // Murukku 200g
  { barcode: '8901234000033', stock: 18 },  // Salted Peanuts
  { barcode: '8901234000034', stock: 35 },  // Maggi 80g
  { barcode: '8901234000035', stock: 10 },  // Navratan Mix
  // Frozen
  { barcode: '8901234000036', stock: 10 },  // Vanilla Ice Cream 1L
  { barcode: '8901234000037', stock: 12 },  // Amul Ice Cream 500ml
  { barcode: '8901234000038', stock: 8 },   // Frozen Peas 1kg
  { barcode: '8901234000039', stock: 8 },   // Frozen Mixed Veg 1kg
  // Bakery
  { barcode: '8901234000040', stock: 15 },  // Modern Bread 400g
  { barcode: '8901234000041', stock: 12 },  // Britannia Toast 400g
  { barcode: '8901234000042', stock: 20 },  // Rusk 300g
  { barcode: '8901234000043', stock: 20 },  // Pav 6pcs
  // Fruits & Vegetables
  { barcode: '8901234000044', stock: 20 },  // Banana Dozen
  { barcode: '8901234000045', stock: 10 },  // Apple 1kg
  { barcode: '8901234000046', stock: 40 },  // Onion 1kg
  { barcode: '8901234000047', stock: 30 },  // Tomato 1kg
  { barcode: '8901234000048', stock: 50 },  // Potato 1kg
  { barcode: '8901234000049', stock: 15 },  // Carrot 1kg
  { barcode: '8901234000050', stock: 30 },  // Green Chilli 100g
  { barcode: '8901234000051', stock: 10 },  // Papaya 1pc
  { barcode: '8901234000052', stock: 12 },  // Cucumber 1kg
  { barcode: '8901234000053', stock: 8 },   // Coconut 1pc
  // Household
  { barcode: '8901234000054', stock: 15 },  // Tide 500g
  { barcode: '8901234000055', stock: 20 },  // Rin 300g
  { barcode: '8901234000056', stock: 18 },  // Dishwash 500ml
  { barcode: '8901234000057', stock: 20 },  // Toilet Cleaner
  { barcode: '8901234000058', stock: 10 },  // Floor Cleaner 1L
  // Personal Care
  { barcode: '8901234000059', stock: 15 },  // Himalaya Soap 5
  { barcode: '8901234000060', stock: 20 },  // Colgate 200g
  { barcode: '8901234000061', stock: 10 },  // H&S Shampoo
  { barcode: '8901234000062', stock: 12 },  // Parachute Oil
  { barcode: '8901234000063', stock: 15 },  // Lux Soap 4
  // Sweets
  { barcode: '8901234000064', stock: 8 },   // Kaju Katli 500g
  { barcode: '8901234000065', stock: 10 },  // Gulab Jamun 12
  { barcode: '8901234000066', stock: 8 },   // Rasgulla 250g
  // Canned Goods
  { barcode: '8901234000067', stock: 6 },   // Dabur Chyawanprash
  { barcode: '8901234000068', stock: 10 },  // Kissan Jam
  { barcode: '8901234000069', stock: 8 },   // Sarson Ka Saal
  // Spices
  { barcode: '8901234000070', stock: 60 },  // Turmeric 100g
  { barcode: '8901234000071', stock: 40 },  // Red Chilli 100g
  { barcode: '8901234000072', stock: 35 },  // Coriander 100g
  { barcode: '8901234000073', stock: 25 },  // Cumin 100g
  { barcode: '8901234000074', stock: 20 },  // Garam Masala 100g
  { barcode: '8901234000075', stock: 30 },  // Haldi 100g
  { barcode: '8901234000076', stock: 15 },  // Mixed Spice
  // Extras
  { barcode: '8901234000077', stock: 20 },  // Parle-G 10pcs
  { barcode: '8901234000078', stock: 15 },  // Amul Cream
  { barcode: '8901234000079', stock: 15 },  // Soyabean Oil 1L
  { barcode: '8901234000080', stock: 12 },  // Mustard Oil 1L
];

stockUpdates.forEach(u => {
  run(`UPDATE Product SET stock = ? WHERE barcode = ?`, [u.stock, u.barcode]);
});
console.log('Stock levels updated for', stockUpdates.length, 'products');

// ════════════════════════════════════════════════════════
// PURCHASE DATA (products IN from suppliers)
// ════════════════════════════════════════════════════════
console.log('\n=== Creating Purchase Invoices ===');

const today = fmt();
const lastWeek = fmt(new Date(now.getTime() - 7*86400000));
const twoWeeks = fmt(new Date(now.getTime() - 14*86400000));
const threeWeeks = fmt(new Date(now.getTime() - 21*86400000));
const fourWeeks = fmt(new Date(now.getTime() - 28*86400000));

// Supplier IDs
const supMap = {};
all('SELECT id, name FROM Supplier').forEach(s => { supMap[s.name] = s.id; });

// Product lookup by barcode
const prodMap = {};
all('SELECT id, barcode, name, sellingPrice, purchasePrice, category FROM Product').forEach(p => { prodMap[p.barcode] = p; });

const purchaseInvoices = [
  // PO-001: Rice & flour from RS Agro Trading (2 weeks ago)
  { supplierId: supMap['RS Agro Trading'], invoiceNo: 'PO-2026-001', date: twoWeeks, dueDate: twoWeeks, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'partial', paymentMethod: 'CASH', notes: 'Monthly rice order', createdBy: 'admin',
    items: [
      { barcode: '8901234000001', qty: 10, unitCost: 40000, discountType: null, discountValue: 0 },  // 10 bags basmati 5kg
      { barcode: '8901234000003', qty: 20, unitCost: 3200, discountType: null, discountValue: 0 },   // 20 bags atta 1kg
      { barcode: '8901234000007', qty: 15, unitCost: 3600, discountType: null, discountValue: 0 },   // 15 bags sooji 1kg
    ]
  },
  // PO-002: Dairy from Patel Dairy Farms (5 days ago)
  { supplierId: supMap['Patel Dairy Farms'], invoiceNo: 'PO-2026-002', date: fmt(new Date(now.getTime() - 5*86400000)), dueDate: fmt(new Date(now.getTime() - 5*86400000 + 7*86400000)), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'pending', paymentMethod: null, notes: 'Weekly dairy delivery', createdBy: 'admin',
    items: [
      { barcode: '8901234000009', qty: 60, unitCost: 650, discountType: null, discountValue: 0 },    // 60 Amul Milk 1L
      { barcode: '8901234000010', qty: 100, unitCost: 350, discountType: null, discountValue: 0 },   // 100 Amul Milk 500ml
      { barcode: '8901234000013', qty: 25, unitCost: 2600, discountType: null, discountValue: 0 },   // 25 trays eggs
      { barcode: '8901234000014', qty: 30, unitCost: 450, discountType: null, discountValue: 0 },    // 30 curd 1L
    ]
  },
  // PO-003: Beverages from Beverages World (10 days ago)
  { supplierId: supMap['Beverages World'], invoiceNo: 'PO-2026-003', date: fmt(new Date(now.getTime() - 10*86400000)), dueDate: fmt(new Date(now.getTime() - 10*86400000 + 15*86400000)), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'partial', paymentMethod: 'UPI', notes: 'Beverage stock replenishment', createdBy: 'admin',
    items: [
      { barcode: '8901234000017', qty: 40, unitCost: 450, discountType: null, discountValue: 0 },   // 40 Coca Cola
      { barcode: '8901234000018', qty: 35, unitCost: 450, discountType: null, discountValue: 0 },   // 35 Pepsi
      { barcode: '8901234000022', qty: 20, unitCost: 1100, discountType: null, discountValue: 0 },  // 20 Red Bull
      { barcode: '8901234000023', qty: 50, unitCost: 1700, discountType: null, discountValue: 0 },  // 50 Bisleri
    ]
  },
  // PO-004: Snacks from Global Staples (3 weeks ago)
  { supplierId: supMap['Global Staples Ltd'], invoiceNo: 'PO-2026-004', date: threeWeeks, dueDate: threeWeeks, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'paid', paymentMethod: 'CASH', notes: 'Snack category restock', createdBy: 'admin',
    items: [
      { barcode: '8901234000028', qty: 60, unitCost: 180, discountType: null, discountValue: 0 },   // 60 Lays
      { barcode: '8901234000030', qty: 20, unitCost: 1100, discountType: null, discountValue: 0 },  // 20 Haldiram Bhujia
      { barcode: '8901234000034', qty: 40, unitCost: 230, discountType: null, discountValue: 0 },   // 40 Maggi
      { barcode: '8901234000035', qty: 12, unitCost: 850, discountType: null, discountValue: 0 },   // 12 Navratan Mix
    ]
  },
  // PO-005: Frozen from RS Agro Trading (15 days ago)
  { supplierId: supMap['RS Agro Trading'], invoiceNo: 'PO-2026-005', date: fmt(new Date(now.getTime() - 15*86400000)), dueDate: fmt(new Date(now.getTime() - 15*86400000 + 15*86400000)), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'paid', paymentMethod: 'UPI', notes: 'Frozen foods order', createdBy: 'admin',
    items: [
      { barcode: '8901234000036', qty: 12, unitCost: 1600, discountType: null, discountValue: 0 },  // 12 Vanilla Ice Cream
      { barcode: '8901234000037', qty: 15, unitCost: 1000, discountType: null, discountValue: 0 },  // 15 Amul Ice Cream
      { barcode: '8901234000038', qty: 10, unitCost: 5500, discountType: null, discountValue: 0 },  // 10 Frozen Peas
    ]
  },
  // PO-006: Household from Clean Home Products (7 days ago, partially paid)
  { supplierId: supMap['Clean Home Products'], invoiceNo: 'PO-2026-006', date: fmt(new Date(now.getTime() - 7*86400000)), dueDate: fmt(new Date(now.getTime() - 7*86400000 + 15*86400000)), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'partial', paymentMethod: 'CASH', notes: 'Household supplies restock', createdBy: 'admin',
    items: [
      { barcode: '8901234000054', qty: 20, unitCost: 850, discountType: null, discountValue: 0 },   // 20 Tide
      { barcode: '8901234000056', qty: 20, unitCost: 600, discountType: null, discountValue: 0 },   // 20 Dishwash
      { barcode: '8901234000057', qty: 25, unitCost: 400, discountType: null, discountValue: 0 },   // 25 Toilet Cleaner
    ]
  },
  // PO-007: Spices from Spice Route India (2 weeks ago, paid)
  { supplierId: supMap['Spice Route India'], invoiceNo: 'PO-2026-007', date: twoWeeks, dueDate: twoWeeks, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'paid', paymentMethod: 'CASH', notes: 'Spice order', createdBy: 'admin',
    items: [
      { barcode: '8901234000070', qty: 80, unitCost: 70, discountType: null, discountValue: 0 },    // 80 Turmeric 100g
      { barcode: '8901234000071', qty: 50, unitCost: 110, discountType: null, discountValue: 0 },   // 50 Red Chilli 100g
      { barcode: '8901234000073', qty: 30, unitCost: 140, discountType: null, discountValue: 0 },   // 30 Cumin 100g
      { barcode: '8901234000074', qty: 25, unitCost: 180, discountType: null, discountValue: 0 },   // 25 Garam Masala 100g
    ]
  },
  // PO-008: Personal Care from Harvest Fresh (1 day ago, pending)
  { supplierId: supMap['Harvest Fresh Fruits'], invoiceNo: 'PO-2026-008', date: fmt(new Date(now.getTime() - 1*86400000)), dueDate: fmt(new Date(now.getTime() - 1*86400000 + 7*86400000)), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'pending', paymentMethod: null, notes: 'Personal care restock', createdBy: 'admin',
    items: [
      { barcode: '8901234000059', qty: 20, unitCost: 2300, discountType: null, discountValue: 0 },  // 20 Himalaya Soap
      { barcode: '8901234000060', qty: 25, unitCost: 1400, discountType: null, discountValue: 0 },  // 25 Colgate
      { barcode: '8901234000062', qty: 15, unitCost: 1800, discountType: null, discountValue: 0 },  // 15 Parachute Oil
    ]
  },
];

const insPurchase = db.prepare(`INSERT INTO PurchaseInvoice (supplierId, invoiceNumber, date, dueDate, subtotal, discountType, discountAmount, taxAmount, totalAmount, amountPaid, status, paymentMethod, notes, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insPurchaseItem = db.prepare(`INSERT INTO PurchaseItem (purchaseInvoiceId, productId, name, quantity, unitCost, discountType, discountValue, taxRate, taxAmount, total, batchNumber, expiryDate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

purchaseInvoices.forEach(po => {
  let subtotal = 0;
  let taxAmount = 0;
  po.items.forEach(item => {
    const prod = prodMap[item.barcode];
    if (!prod) { console.warn(`Product not found: ${item.barcode}`); return; }
    const lineTotal = item.qty * item.unitCost;
    subtotal += lineTotal;
    taxAmount += Math.round(lineTotal * prod.taxRate / 100);
  });
  const totalAmount = subtotal + taxAmount;
  const discountAmount = 0;

  const result = insPurchase.run(
    po.supplierId, po.invoiceNo, po.date, po.dueDate,
    Math.round(subtotal), po.discountType || null, discountAmount,
    Math.round(taxAmount), Math.round(totalAmount), po.amountPaid || 0,
    po.status, po.paymentMethod || null, po.notes, po.createdBy, po.date, po.date
  );

  if (result.lastInsertRowid) {
    const poId = result.lastInsertRowid;
    po.items.forEach(item => {
      const prod = prodMap[item.barcode];
      if (!prod) return;
      const lineTotal = item.qty * item.unitCost;
      const lineTax = Math.round(lineTotal * prod.taxRate / 100);
      insPurchaseItem.run(poId, prod.id, prod.name, item.qty, item.unitCost, item.discountType || null, item.discountValue || 0, prod.taxRate, lineTax, lineTotal + lineTax, null, null);
    });
    console.log(`Purchase ${po.invoiceNo}: ₹${totalAmount} from ${po.supplierId} — ${po.items.length} items`);
  }
});

// ════════════════════════════════════════════════════════
// SALES DATA (products OUT to customers)
// ════════════════════════════════════════════════════════
console.log('\n=== Creating Sales Invoices ===');

const custMap = {};
all('SELECT id, name FROM Customer').forEach(c => { custMap[c.name] = c.id; });
const smMap = {};
all('SELECT id, name FROM Salesman').forEach(s => { smMap[s.name] = s.id; });

const salesInvoices = [
  // INV-001: Daily sales — Ram Lal (B-tier), cash
  { customerId: custMap['Ram Lal'], customerName: 'Ram Lal', customerPhone: '9876543101', salesmanId: smMap['Rajesh Kumar'], invoiceNo: 'INV-2026-001', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000001', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },  // 2x Basmati Rice 5kg MRP
      { barcode: '8901234000009', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },  // 2x Amul Milk 1L MRP
      { barcode: '8901234000044', qty: 1, rateTier: 'B', discountType: null, discountValue: 0 },  // 1x Banana Dozen
    ]
  },
  // INV-002: Sunita Devi (A-tier wholesale), UPI, has previous due
  { customerId: custMap['Sunita Devi'], customerName: 'Sunita Devi', customerPhone: '9876543102', salesmanId: smMap['Priya Sharma'], invoiceNo: 'INV-2026-002', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000001', qty: 10, rateTier: 'A', discountType: null, discountValue: 0 },  // 10x Basmati Rice 5kg wholesale
      { barcode: '8901234000004', qty: 5, rateTier: 'A', discountType: null, discountValue: 0 },   // 5x Toor Dal 1kg wholesale
      { barcode: '8901234000017', qty: 20, rateTier: 'A', discountType: null, discountValue: 0 },  // 20x Coca Cola wholesale
    ]
  },
  // INV-003: Ramesh Babu (C-tier special), cash, small bill
  { customerId: custMap['Ramesh Babu'], customerName: 'Ramesh Babu', customerPhone: '9876543103', salesmanId: smMap['Rajesh Kumar'], invoiceNo: 'INV-2026-003', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000028', qty: 3, rateTier: 'C', discountType: null, discountValue: 0 },   // 3x Lays
      { barcode: '8901234000030', qty: 1, rateTier: 'C', discountType: null, discountValue: 0 },   // 1x Haldiram Bhujia
      { barcode: '8901234000051', qty: 2, rateTier: 'C', discountType: null, discountValue: 0 },   // 2x Papaya
      { barcode: '8901234000064', qty: 1, rateTier: 'C', discountType: null, discountValue: 0 },   // 1x Kaju Katli
    ]
  },
  // INV-004: Lakshmi Bai (B-tier), credit (due), UPI partial payment
  { customerId: custMap['Lakshmi Bai'], customerName: 'Lakshmi Bai', customerPhone: '9876543104', salesmanId: smMap['Mohan Das'], invoiceNo: 'INV-2026-004', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000002', qty: 5, rateTier: 'B', discountType: null, discountValue: 0 },    // 5x Basmati Rice 1kg
      { barcode: '8901234000011', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },    // 2x Amul Butter
      { barcode: '8901234000017', qty: 10, rateTier: 'B', discountType: null, discountValue: 0 },   // 10x Coca Cola
      { barcode: '8901234000020', qty: 5, rateTier: 'B', discountType: null, discountValue: 0 },    // 5x Frooti
    ]
  },
  // INV-005: Krishna Murthy (A-tier, big spender), UPI
  { customerId: custMap['Krishna Murthy'], customerName: 'Krishna Murthy', customerPhone: '9876543105', salesmanId: smMap['Rajesh Kumar'], invoiceNo: 'INV-2026-005', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000001', qty: 20, rateTier: 'A', discountType: null, discountValue: 0 },   // 20x Basmati 5kg wholesale
      { barcode: '8901234000002', qty: 10, rateTier: 'A', discountType: null, discountValue: 0 },   // 10x Basmati 1kg wholesale
      { barcode: '8901234000009', qty: 30, rateTier: 'A', discountType: null, discountValue: 0 },   // 30x Amul Milk 1L wholesale
      { barcode: '8901234000013', qty: 5, rateTier: 'A', discountType: null, discountValue: 0 },    // 5x Egg trays wholesale
      { barcode: '8901234000023', qty: 10, rateTier: 'A', discountType: null, discountValue: 0 },   // 10x Bisleri wholesale
      { barcode: '8901234000045', qty: 5, rateTier: 'A', discountType: null, discountValue: 0 },    // 5x Apple 1kg wholesale
      { barcode: '8901234000064', qty: 3, rateTier: 'A', discountType: null, discountValue: 0 },    // 3x Kaju Katli wholesale
    ]
  },
  // INV-006: Padmaja Garu (B-tier), cash, yesterday
  { customerId: custMap['Padmaja Garu'], customerName: 'Padmaja Garu', customerPhone: '9876543106', salesmanId: smMap['Priya Sharma'], invoiceNo: 'INV-2026-006', date: fmt(new Date(now.getTime() - 1*86400000)), subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000010', qty: 6, rateTier: 'B', discountType: null, discountValue: 0 },    // 6x Amul Milk 500ml
      { barcode: '8901234000040', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },   // 2x Modern Bread
      { barcode: '8901234000044', qty: 1, rateTier: 'B', discountType: null, discountValue: 0 },   // 1x Banana Dozen
      { barcode: '8901234000054', qty: 1, rateTier: 'B', discountType: null, discountValue: 0 },   // 1x Tide Detergent
    ]
  },
  // INV-007: Suresh Reddy (C-tier), cash, yesterday
  { customerId: custMap['Suresh Reddy'], customerName: 'Suresh Reddy', customerPhone: '9876543107', salesmanId: smMap['Priya Sharma'], invoiceNo: 'INV-2026-007', date: fmt(new Date(now.getTime() - 1*86400000)), subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000034', qty: 3, rateTier: 'C', discountType: null, discountValue: 0 },   // 3x Maggi
      { barcode: '8901234000028', qty: 5, rateTier: 'C', discountType: null, discountValue: 0 },   // 5x Lays
      { barcode: '8901234000078', qty: 3, rateTier: 'C', discountType: null, discountValue: 0 },   // 3x Amul Cream
    ]
  },
  // INV-008: Anitha K (B-tier), credit (due), UPI
  { customerId: custMap['Anitha K'], customerName: 'Anitha K', customerPhone: '9876543108', salesmanId: smMap['Rajesh Kumar'], invoiceNo: 'INV-2026-008', date: today, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
    items: [
      { barcode: '8901234000009', qty: 3, rateTier: 'B', discountType: null, discountValue: 0 },    // 3x Amul Milk 1L
      { barcode: '8901234000014', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },   // 2x Curd 1L
      { barcode: '8901234000046', qty: 2, rateTier: 'B', discountType: null, discountValue: 0 },   // 2x Onion 1kg
      { barcode: '8901234000054', qty: 1, rateTier: 'B', discountType: null, discountValue: 0 },   // 1x Tide
    ]
  },
];

const insInvoice = db.prepare(`INSERT INTO Invoice (invoiceNumber, customerId, customerName, customerPhone, salesmanId, subtotal, discountType, discountValue, discountAmount, taxAmount, loyaltyDiscount, totalAmount, paymentMethod, amountPaid, changeDue, dueAmount, previousDuePaid, returnValue, creditApplied, refundValue, refundMode, pointsRedeemed, pointsEarned, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insInvoiceItem = db.prepare(`INSERT INTO InvoiceItem (invoiceId, productId, name, unit, rateTier, quantity, price, discountType, discountValue, taxRate, taxAmount, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
const insInvoicePayment = db.prepare(`INSERT INTO InvoicePayment (invoiceId, method, amount) VALUES (?,?,?)`);

salesInvoices.forEach(inv => {
  let subtotal = 0;
  let taxAmount = 0;
  inv.items.forEach(item => {
    const prod = prodMap[item.barcode];
    if (!prod) { console.warn(`Product not found: ${item.barcode}`); return; }
    // Use rateTier price
    let price;
    if (item.rateTier === 'A') price = prod.rateA;
    else if (item.rateTier === 'C') price = prod.rateC;
    else price = prod.rateB; // B = MRP
    if (!price) price = prod.sellingPrice;

    const lineTotal = price * item.qty;
    const lineTax = Math.round(lineTotal * prod.taxRate / 100);
    subtotal += lineTotal;
    taxAmount += lineTax;
  });

  const discountAmount = 0;
  const totalAmount = Math.round(subtotal + taxAmount);

  const result = insInvoice.run(
    inv.invoiceNo, inv.customerId, inv.customerName, inv.customerPhone, inv.salesmanId,
    Math.round(subtotal), inv.discountType || null, inv.discountValue || 0, discountAmount,
    Math.round(taxAmount), inv.loyaltyDiscount || 0, totalAmount,
    inv.paymentMethod, inv.amountPaid || 0, inv.changeDue || 0, inv.dueAmount || 0,
    inv.previousDuePaid || 0, inv.returnValue || 0, inv.creditApplied || 0,
    inv.refundValue || 0, inv.refundMode || null, inv.pointsRedeemed || 0, inv.pointsEarned || 0,
    inv.date
  );

  if (result.lastInsertRowid) {
    const invId = result.lastInsertRowid;
    inv.items.forEach(item => {
      const prod = prodMap[item.barcode];
      if (!prod) return;
      let price;
      if (item.rateTier === 'A') price = prod.rateA;
      else if (item.rateTier === 'C') price = prod.rateC;
      else price = prod.rateB;
      if (!price) price = prod.sellingPrice;
      const lineTotal = price * item.qty;
      const lineTax = Math.round(lineTotal * prod.taxRate / 100);
      insInvoiceItem.run(invId, prod.id, prod.name, prod.unit, item.rateTier, item.qty, price, item.discountType || null, item.discountValue || 0, prod.taxRate, lineTax, lineTotal + lineTax);
    });
    // Add payment
    insInvoicePayment.run(invId, inv.paymentMethod, totalAmount);
    console.log(`Invoice ${inv.invoiceNo}: ₹${totalAmount} (${inv.items.length} items) — ${inv.paymentMethod} — ${inv.customerName}`);
  }
});

// ════════════════════════════════════════════════════════
// UPDATE PRODUCT STOCK (deduct sales from stock)
// ════════════════════════════════════════════════════════
console.log('\n=== Updating stock based on sales ===');

// Get all invoice items and deduct from stock
const allInvoiceItems = all('SELECT ii.productId, ii.quantity, p.barcode FROM InvoiceItem ii JOIN Product p ON ii.productId = p.id');
allInvoiceItems.forEach(ii => {
  const prod = prodMap[ii.barcode];
  if (prod) {
    run(`UPDATE Product SET stock = MAX(0, stock - ?) WHERE id = ?`, [ii.quantity, ii.productId]);
  }
});

// ════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════
const totalPurchases = get('SELECT COUNT(*) as c FROM PurchaseInvoice').c;
const totalSales = get('SELECT COUNT(*) as c FROM Invoice').c;
const totalPurchaseItems = get('SELECT COUNT(*) as c FROM PurchaseItem').c;
const totalInvoiceItems = get('SELECT COUNT(*) as c FROM InvoiceItem').c;
const totalPurchaseAmt = get('SELECT SUM(totalAmount) as s FROM PurchaseInvoice').s || 0;
const totalSalesAmt = get('SELECT SUM(totalAmount) as s FROM Invoice').s || 0;
const totalPaid = get('SELECT SUM(amountPaid) as s FROM Invoice').s || 0;

console.log('\n=== SEED SUMMARY ===');
console.log(`Purchase Invoices: ${totalPurchases} (₹${totalPurchaseAmt} total)`);
console.log(`  - Purchase Items: ${totalPurchaseItems}`);
console.log(`Sales Invoices: ${totalSales} (₹${totalSalesAmt} total)`);
console.log(`  - Invoice Items: ${totalInvoiceItems}`);
console.log(`  - Payments recorded: ${totalPaid}`);
console.log(`Products: ${existingProds} (stock updated)`);
console.log(`Customers: ${existingCusts}`);
console.log(`Suppliers: ${existingSups}`);
console.log('Salesmen: 3');

db.close();
