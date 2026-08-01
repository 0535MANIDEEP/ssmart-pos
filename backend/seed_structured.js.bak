const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = 'file:./data/pos.db';
const backendRoot = path.resolve(__dirname);
const dbFile = dbUrl.replace('file:', '');
const resolvedDbPath = path.resolve(backendRoot, dbFile);
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const now = new Date();
const ts = (d = now) => d.toISOString();
const fmtDate = (d = now) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

async function main() {
  console.log('=== Structured Seed Starting ===');

  // Clear transactional data
  await prisma.invoiceItem.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.customerDuePayment.deleteMany();
  console.log('Cleared transactional data');

  // Fetch existing base data
  const [products, customers, suppliers, salesmen] = await Promise.all([
    prisma.product.findMany({ select: { id: true, barcode: true, name: true, sellingPrice: true, purchasePrice: true, taxRate: true, category: true, unit: true } }),
    prisma.customer.findMany({ select: { id: true, name: true, phone: true, rateTier: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
    prisma.salesman.findMany({ select: { id: true, name: true } }),
  ]);

  const prodByBarcode = {};
  products.forEach(p => { prodByBarcode[p.barcode] = p; });
  const custByName = {};
  customers.forEach(c => { custByName[c.name] = c; });
  const supByName = {};
  suppliers.forEach(s => { supByName[s.name] = s; });
  const smByName = {};
  salesmen.forEach(s => { smByName[s.name] = s; });

  console.log(`Loaded: ${products.length} products, ${customers.length} customers, ${suppliers.length} suppliers, ${salesmen.length} salesmen`);

  if (products.length < 5) { console.error('Not enough products! Run basic seed first.'); process.exit(1); }

  // ════════════════════════════
  // PURCHASE INVOICES (products IN from suppliers)
  // ════════════════════════════
  const today = fmtDate();
  const twoWeeksAgo = fmtDate(new Date(now.getTime() - 14 * 86400000));
  const threeWeeksAgo = fmtDate(new Date(now.getTime() - 21 * 86400000));
  const lastWeek = fmtDate(new Date(now.getTime() - 7 * 86400000));
  const yesterday = fmtDate(new Date(now.getTime() - 1 * 86400000));
  const tomorrow = fmtDate(new Date(now.getTime() + 1 * 86400000));
  const nextWeek = fmtDate(new Date(now.getTime() + 7 * 86400000));

  console.log('\n=== Creating Purchase Invoices ===');

  const po1 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['RS Agro Trading'].id,
      invoiceNumber: 'PO-2026-001',
      date: threeWeeksAgo,
      dueDate: threeWeeksAgo,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 47000, status: 'partial',
      paymentMethod: 'CASH', notes: 'Monthly rice & flour order', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000001'].id, name: prodByBarcode['8901234000001'].name, quantity: 10, unitCost: 40000, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 72000, total: 472000, batchNumber: 'RICE-001', expiryDate: null },
          { productId: prodByBarcode['8901234000003'].id, name: prodByBarcode['8901234000003'].name, quantity: 20, unitCost: 3200, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 115200, total: 755200, batchNumber: 'FLOUR-001', expiryDate: null },
          { productId: prodByBarcode['8901234000007'].id, name: prodByBarcode['8901234000007'].name, quantity: 15, unitCost: 3600, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 97200, total: 637200, batchNumber: 'SOOJI-001', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po1.invoiceNumber}: ₹${po1.totalAmount} from ${po1.supplierId} — 3 items`);

  const po2 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Patel Dairy Farms'].id,
      invoiceNumber: 'PO-2026-002',
      date: lastWeek,
      dueDate: nextWeek,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'pending',
      paymentMethod: null, notes: 'Weekly dairy delivery', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000009'].id, name: prodByBarcode['8901234000009'].name, quantity: 60, unitCost: 650, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 70200, total: 460200, batchNumber: 'MILK-1L', expiryDate: null },
          { productId: prodByBarcode['8901234000010'].id, name: prodByBarcode['8901234000010'].name, quantity: 100, unitCost: 350, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 63000, total: 413000, batchNumber: 'MILK-500ml', expiryDate: null },
          { productId: prodByBarcode['8901234000013'].id, name: prodByBarcode['8901234000013'].name, quantity: 25, unitCost: 2600, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 117000, total: 767000, batchNumber: 'EGG-30', expiryDate: null },
          { productId: prodByBarcode['8901234000014'].id, name: prodByBarcode['8901234000014'].name, quantity: 30, unitCost: 450, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 24300, total: 159300, batchNumber: 'CURD-1L', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po2.invoiceNumber}: ₹${po2.totalAmount} from ${po2.supplierId} — 4 items`);

  const po3 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Beverages World'].id,
      invoiceNumber: 'PO-2026-003',
      date: fmtDate(new Date(now.getTime() - 10 * 86400000)),
      dueDate: fmtDate(new Date(now.getTime() - 10 * 86400000 + 15 * 86400000)),
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 120000, status: 'partial',
      paymentMethod: 'UPI', notes: 'Beverage stock replenishment', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000017'].id, name: prodByBarcode['8901234000017'].name, quantity: 40, unitCost: 450, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 32400, total: 212400, batchNumber: 'COCA-1.25L', expiryDate: null },
          { productId: prodByBarcode['8901234000018'].id, name: prodByBarcode['8901234000018'].name, quantity: 35, unitCost: 450, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 28350, total: 186750, batchNumber: 'PEPSI-1.25L', expiryDate: null },
          { productId: prodByBarcode['8901234000022'].id, name: prodByBarcode['8901234000022'].name, quantity: 20, unitCost: 1100, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 15840, total: 102800, batchNumber: 'RB-250ML', expiryDate: null },
          { productId: prodByBarcode['8901234000023'].id, name: prodByBarcode['8901234000023'].name, quantity: 50, unitCost: 1700, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 153000, total: 1003000, batchNumber: 'BIS-1L', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po3.invoiceNumber}: ₹${po3.totalAmount} from ${po3.supplierId} — 4 items`);

  const po4 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Global Staples Ltd'].id,
      invoiceNumber: 'PO-2026-004',
      date: threeWeeksAgo,
      dueDate: threeWeeksAgo,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'paid',
      paymentMethod: 'CASH', notes: 'Snack category restock', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000028'].id, name: prodByBarcode['8901234000028'].name, quantity: 60, unitCost: 180, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 19440, total: 127440, batchNumber: 'LAYS-40G', expiryDate: null },
          { productId: prodByBarcode['8901234000030'].id, name: prodByBarcode['8901234000030'].name, quantity: 20, unitCost: 1100, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 39600, total: 259600, batchNumber: 'HAL-BHUJIA', expiryDate: null },
          { productId: prodByBarcode['8901234000034'].id, name: prodByBarcode['8901234000034'].name, quantity: 40, unitCost: 230, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 16560, total: 108960, batchNumber: 'MAGGI-80G', expiryDate: null },
          { productId: prodByBarcode['8901234000035'].id, name: prodByBarcode['8901234000035'].name, quantity: 12, unitCost: 850, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 18360, total: 120360, batchNumber: 'NAVRATAN', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po4.invoiceNumber}: ₹${po4.totalAmount} from ${po4.supplierId} — 4 items`);

  const po5 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['RS Agro Trading'].id,
      invoiceNumber: 'PO-2026-005',
      date: fmtDate(new Date(now.getTime() - 15 * 86400000)),
      dueDate: fmtDate(new Date(now.getTime() - 15 * 86400000 + 15 * 86400000)),
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'paid',
      paymentMethod: 'UPI', notes: 'Frozen foods order', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000036'].id, name: prodByBarcode['8901234000036'].name, quantity: 12, unitCost: 1600, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 21600, total: 213600, batchNumber: 'VAN-1L', expiryDate: null },
          { productId: prodByBarcode['8901234000037'].id, name: prodByBarcode['8901234000037'].name, quantity: 15, unitCost: 1000, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 27000, total: 180000, batchNumber: 'AMUL-IC-500', expiryDate: null },
          { productId: prodByBarcode['8901234000038'].id, name: prodByBarcode['8901234000038'].name, quantity: 10, unitCost: 5500, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 99000, total: 649000, batchNumber: 'FROZ-Pea', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po5.invoiceNumber}: ₹${po5.totalAmount} from ${po5.supplierId} — 3 items`);

  const po6 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Clean Home Products'].id,
      invoiceNumber: 'PO-2026-006',
      date: lastWeek,
      dueDate: nextWeek,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'partial',
      paymentMethod: 'CASH', notes: 'Household supplies restock', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000054'].id, name: prodByBarcode['8901234000054'].name, quantity: 20, unitCost: 850, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 30600, total: 200600, batchNumber: 'TIDE-500', expiryDate: null },
          { productId: prodByBarcode['8901234000056'].id, name: prodByBarcode['8901234000056'].name, quantity: 20, unitCost: 600, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 21600, total: 141600, batchNumber: 'DISH-500', expiryDate: null },
          { productId: prodByBarcode['8901234000057'].id, name: prodByBarcode['8901234000057'].name, quantity: 25, unitCost: 400, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 18000, total: 118000, batchNumber: 'TOIL-500', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po6.invoiceNumber}: ₹${po6.totalAmount} from ${po6.supplierId} — 3 items`);

  const po7 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Spice Route India'].id,
      invoiceNumber: 'PO-2026-007',
      date: twoWeeksAgo,
      dueDate: twoWeeksAgo,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'paid',
      paymentMethod: 'CASH', notes: 'Spice order', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000070'].id, name: prodByBarcode['8901234000070'].name, quantity: 80, unitCost: 70, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 10080, total: 66480, batchNumber: 'Haldi-100', expiryDate: null },
          { productId: prodByBarcode['8901234000071'].id, name: prodByBarcode['8901234000071'].name, quantity: 50, unitCost: 110, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 9900, total: 64900, batchNumber: 'RedChilli-100', expiryDate: null },
          { productId: prodByBarcode['8901234000073'].id, name: prodByBarcode['8901234000073'].name, quantity: 30, unitCost: 140, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 7560, total: 49560, batchNumber: 'Cumin-100', expiryDate: null },
          { productId: prodByBarcode['8901234000074'].id, name: prodByBarcode['8901234000074'].name, quantity: 25, unitCost: 180, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 8100, total: 53100, batchNumber: 'GaramMasala', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po7.invoiceNumber}: ₹${po7.totalAmount} from ${po7.supplierId} — 4 items`);

  const po8 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: supByName['Harvest Fresh Fruits'].id,
      invoiceNumber: 'PO-2026-008',
      date: yesterday,
      dueDate: tomorrow,
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'pending',
      paymentMethod: null, notes: 'Personal care restock', createdBy: 'admin', createdAt: ts(), updatedAt: ts(),
      items: {
        create: [
          { productId: prodByBarcode['8901234000059'].id, name: prodByBarcode['8901234000059'].name, quantity: 20, unitCost: 2300, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 82800, total: 542800, batchNumber: 'HIMA-SOAP', expiryDate: null },
          { productId: prodByBarcode['8901234000060'].id, name: prodByBarcode['8901234000060'].name, quantity: 25, unitCost: 1400, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 63000, total: 413000, batchNumber: 'COLG-200', expiryDate: null },
          { productId: prodByBarcode['8901234000062'].id, name: prodByBarcode['8901234000062'].name, quantity: 15, unitCost: 1800, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 48600, total: 318600, batchNumber: 'PARA-500ML', expiryDate: null },
        ]
      }
    }
  });
  console.log(`  ${po8.invoiceNumber}: ₹${po8.totalAmount} from ${po8.supplierId} — 3 items`);

  // ════════════════════════════
  // SALES INVOICES (products OUT to customers)
  // ════════════════════════════
  console.log('\n=== Creating Sales Invoices ===');

  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-101',
      customerId: custByName['Ram Lal'].id, customerName: 'Ram Lal', customerPhone: '9876543101',
      salesmanId: smByName['Rajesh Kumar'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(),
      items: { create: [
        { productId: prodByBarcode['8901234000001'].id, name: prodByBarcode['8901234000001'].name, unit: 'kg', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000001'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 1620, total: 10260 },
        { productId: prodByBarcode['8901234000009'].id, name: prodByBarcode['8901234000009'].name, unit: 'pc', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000009'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 270, total: 1770 },
        { productId: prodByBarcode['8901234000044'].id, name: prodByBarcode['8901234000044'].name, unit: 'dozen', rateTier: 'B', quantity: 1, price: prodByBarcode['8901234000044'].sellingPrice, discountType: null, discountValue: 0, taxRate: 0, taxAmount: 0, total: 1000 },
      ] },
      payments: { create: { method: 'CASH', amount: 13030 } }
    }
  });
  await prisma.invoice.update({ where: { id: inv1.id }, data: { amountPaid: 13030 } });
  console.log(`  ${inv1.invoiceNumber}: ₹${inv1.totalAmount} — ${inv1.customerName} (${inv1.paymentMethod}) — PAID`);

  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-102',
      customerId: custByName['Sunita Devi'].id, customerName: 'Sunita Devi', customerPhone: '9876543102',
      salesmanId: smByName['Priya Sharma'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000001'].id, name: prodByBarcode['8901234000001'].name, unit: 'kg', rateTier: 'A', quantity: 10, price: prodByBarcode['8901234000001'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 81000, total: 531000 },
        { productId: prodByBarcode['8901234000004'].id, name: prodByBarcode['8901234000004'].name, unit: 'kg', rateTier: 'A', quantity: 5, price: prodByBarcode['8901234000004'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 121500, total: 796500 },
        { productId: prodByBarcode['8901234000017'].id, name: prodByBarcode['8901234000017'].name, unit: 'pc', rateTier: 'A', quantity: 20, price: prodByBarcode['8901234000017'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 16200, total: 106200 },
      ]}, payments: { create: { method: 'UPI', amount: 0 } }
    }
  });
  console.log(`  ${inv2.invoiceNumber}: ₹${inv2.totalAmount} — ${inv2.customerName} (${inv2.paymentMethod})`);

  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-103',
      customerId: custByName['Ramesh Babu'].id, customerName: 'Ramesh Babu', customerPhone: '9876543103',
      salesmanId: smByName['Rajesh Kumar'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000028'].id, name: prodByBarcode['8901234000028'].name, unit: 'pc', rateTier: 'C', quantity: 3, price: prodByBarcode['8901234000028'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 108, total: 660 },
        { productId: prodByBarcode['8901234000030'].id, name: prodByBarcode['8901234000030'].name, unit: 'pc', rateTier: 'C', quantity: 1, price: prodByBarcode['8901234000030'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 252, total: 1652 },
        { productId: prodByBarcode['8901234000051'].id, name: prodByBarcode['8901234000051'].name, unit: 'pc', rateTier: 'C', quantity: 2, price: prodByBarcode['8901234000051'].sellingPrice, discountType: null, discountValue: 0, taxRate: 0, taxAmount: 0, total: 700 },
        { productId: prodByBarcode['8901234000064'].id, name: prodByBarcode['8901234000064'].name, unit: '500g', rateTier: 'C', quantity: 1, price: prodByBarcode['8901234000064'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 270, total: 2250 },
      ]}, payments: { create: { method: 'CASH', amount: 0 } }
    }
  });
  console.log(`  ${inv3.invoiceNumber}: ₹${inv3.totalAmount} — ${inv3.customerName} (${inv3.paymentMethod})`);

  const inv4 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-104',
      customerId: custByName['Lakshmi Bai'].id, customerName: 'Lakshmi Bai', customerPhone: '9876543104',
      salesmanId: smByName['Mohan Das'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000002'].id, name: prodByBarcode['8901234000002'].name, unit: 'kg', rateTier: 'B', quantity: 5, price: prodByBarcode['8901234000002'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 810, total: 5400 },
        { productId: prodByBarcode['8901234000011'].id, name: prodByBarcode['8901234000011'].name, unit: 'pc', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000011'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 1404, total: 9604 },
        { productId: prodByBarcode['8901234000017'].id, name: prodByBarcode['8901234000017'].name, unit: 'pc', rateTier: 'B', quantity: 10, price: prodByBarcode['8901234000017'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 1080, total: 6380 },
        { productId: prodByBarcode['8901234000020'].id, name: prodByBarcode['8901234000020'].name, unit: 'pc', rateTier: 'B', quantity: 5, price: prodByBarcode['8901234000020'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 450, total: 2950 },
      ]}, payments: { create: { method: 'UPI', amount: 0 } }
    }
  });
  console.log(`  ${inv4.invoiceNumber}: ₹${inv4.totalAmount} — ${inv4.customerName} (${inv4.paymentMethod})`);

  const inv5 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-105',
      customerId: custByName['Krishna Murthy'].id, customerName: 'Krishna Murthy', customerPhone: '9876543105',
      salesmanId: smByName['Rajesh Kumar'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000001'].id, name: prodByBarcode['8901234000001'].name, unit: 'kg', rateTier: 'A', quantity: 20, price: prodByBarcode['8901234000001'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 162000, total: 1062000 },
        { productId: prodByBarcode['8901234000002'].id, name: prodByBarcode['8901234000002'].name, unit: 'kg', rateTier: 'A', quantity: 10, price: prodByBarcode['8901234000002'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 15300, total: 100300 },
        { productId: prodByBarcode['8901234000009'].id, name: prodByBarcode['8901234000009'].name, unit: 'pc', rateTier: 'A', quantity: 30, price: prodByBarcode['8901234000009'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 40500, total: 270000 },
        { productId: prodByBarcode['8901234000013'].id, name: prodByBarcode['8901234000013'].name, unit: 'trays', rateTier: 'A', quantity: 5, price: prodByBarcode['8901234000013'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 27000, total: 177000 },
        { productId: prodByBarcode['8901234000023'].id, name: prodByBarcode['8901234000023'].name, unit: 'pc', rateTier: 'A', quantity: 10, price: prodByBarcode['8901234000023'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 3240, total: 21600 },
        { productId: prodByBarcode['8901234000045'].id, name: prodByBarcode['8901234000045'].name, unit: 'kg', rateTier: 'A', quantity: 5, price: prodByBarcode['8901234000045'].rateA, discountType: null, discountValue: 0, taxRate: 0, taxAmount: 0, total: 9900 },
        { productId: prodByBarcode['8901234000064'].id, name: prodByBarcode['8901234000064'].name, unit: '500g', rateTier: 'A', quantity: 3, price: prodByBarcode['8901234000064'].rateA, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 6075, total: 40725 },
      ]}, payments: { create: { method: 'UPI', amount: 0 } }
    }
  });
  console.log(`  ${inv5.invoiceNumber}: ₹${inv5.totalAmount} — ${inv5.customerName} (${inv5.paymentMethod})`);

  const inv6 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-106',
      customerId: custByName['Padmaja Garu'].id, customerName: 'Padmaja Garu', customerPhone: '9876543106',
      salesmanId: smByName['Priya Sharma'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000010'].id, name: prodByBarcode['8901234000010'].name, unit: 'pc', rateTier: 'B', quantity: 6, price: prodByBarcode['8901234000010'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 540, total: 3540 },
        { productId: prodByBarcode['8901234000040'].id, name: prodByBarcode['8901234000040'].name, unit: 'loaf', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000040'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 180, total: 1180 },
        { productId: prodByBarcode['8901234000044'].id, name: prodByBarcode['8901234000044'].name, unit: 'dozen', rateTier: 'B', quantity: 1, price: prodByBarcode['8901234000044'].sellingPrice, discountType: null, discountValue: 0, taxRate: 0, taxAmount: 0, total: 1000 },
        { productId: prodByBarcode['8901234000054'].id, name: prodByBarcode['8901234000054'].name, unit: 'pc', rateTier: 'B', quantity: 1, price: prodByBarcode['8901234000054'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 189, total: 1239 },
      ]}, payments: { create: { method: 'CASH', amount: 0 } }
    }
  });
  console.log(`  ${inv6.invoiceNumber}: ₹${inv6.totalAmount} — ${inv6.customerName} (${inv6.paymentMethod})`);

  const inv7 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-107',
      customerId: custByName['Suresh Reddy'].id, customerName: 'Suresh Reddy', customerPhone: '9876543107',
      salesmanId: smByName['Priya Sharma'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000034'].id, name: prodByBarcode['8901234000034'].name, unit: 'pc', rateTier: 'C', quantity: 3, price: prodByBarcode['8901234000034'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 135, total: 870 },
        { productId: prodByBarcode['8901234000028'].id, name: prodByBarcode['8901234000028'].name, unit: 'pc', rateTier: 'C', quantity: 5, price: prodByBarcode['8901234000028'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 180, total: 1280 },
        { productId: prodByBarcode['8901234000078'].id, name: prodByBarcode['8901234000078'].name, unit: 'pc', rateTier: 'C', quantity: 3, price: prodByBarcode['8901234000078'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 324, total: 2124 },
      ]}, payments: { create: { method: 'CASH', amount: 0 } }
    }
  });
  console.log(`  ${inv7.invoiceNumber}: ₹${inv7.totalAmount} — ${inv7.customerName} (${inv7.paymentMethod})`);

  const inv8 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-108',
      customerId: custByName['Anitha K'].id, customerName: 'Anitha K', customerPhone: '9876543108',
      salesmanId: smByName['Rajesh Kumar'].id,
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: ts(), items: { create: [
        { productId: prodByBarcode['8901234000009'].id, name: prodByBarcode['8901234000009'].name, unit: 'pc', rateTier: 'B', quantity: 3, price: prodByBarcode['8901234000009'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 405, total: 2655 },
        { productId: prodByBarcode['8901234000014'].id, name: prodByBarcode['8901234000014'].name, unit: 'pc', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000014'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 198, total: 1398 },
        { productId: prodByBarcode['8901234000046'].id, name: prodByBarcode['8901234000046'].name, unit: 'kg', rateTier: 'B', quantity: 2, price: prodByBarcode['8901234000046'].sellingPrice, discountType: null, discountValue: 0, taxRate: 0, taxAmount: 0, total: 1000 },
        { productId: prodByBarcode['8901234000054'].id, name: prodByBarcode['8901234000054'].name, unit: 'pc', rateTier: 'B', quantity: 1, price: prodByBarcode['8901234000054'].sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: 189, total: 1239 },
      ]}, payments: { create: { method: 'UPI', amount: 0 } }
    }
  });
  console.log(`  ${inv8.invoiceNumber}: ₹${inv8.totalAmount} — ${inv8.customerName} (${inv8.paymentMethod})`);

  // ════════════════════════════
  // UPDATE STOCK: deduct sales
  // ════════════════════════════
  console.log('\n=== Updating stock (deducting sales) ===');
  const allSoldItems = await prisma.invoiceItem.findMany({ select: { productId: true, quantity: true } });
  for (const item of allSoldItems) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } }
    });
  }
  console.log(`Deducted ${allSoldItems.length} line items from stock`);

  // ════════════════════════════
  // SUMMARY
  // ════════════════════════════
  const totalPurchases = (await prisma.purchaseInvoice.count());
  const totalSales = (await prisma.invoice.count());
  const totalPurchaseItems = (await prisma.purchaseItem.count());
  const totalInvoiceItems = (await prisma.invoiceItem.count());
  const totalPurchaseAmt = (await prisma.purchaseInvoice.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount || 0;
  const totalSalesAmt = (await prisma.invoice.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount || 0;
  const totalStock = (await prisma.product.aggregate({ _sum: { stock: true } }))._sum.stock;
  const lowStockCount = (await prisma.product.count({ where: { stock: { lte: 5 } } }));

  console.log('\n=== SEED SUMMARY ===');
  console.log(`Purchase Invoices: ${totalPurchases} (₹${totalPurchaseAmt} total)`);
  console.log(`  Purchase Items: ${totalPurchaseItems}`);
  console.log(`Sales Invoices: ${totalSales} (₹${totalSalesAmt} total)`);
  console.log(`  Invoice Items: ${totalInvoiceItems}`);
  console.log('');
  console.log(`Products: ${products.length}`);
  console.log(`Total stock: ${totalStock}`);
  console.log(`Low-stock items (≤5): ${lowStockCount}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Suppliers: ${suppliers.length}`);
  console.log(`Salesmen: ${salesmen.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
