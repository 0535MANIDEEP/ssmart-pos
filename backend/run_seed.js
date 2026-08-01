const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = 'file:./data/pos.db';
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Structured Seed ===');

  // Clear transactional data
  await prisma.invoiceItem.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  console.log('Cleared transactional data');

  // Fetch base data
  const products = await prisma.product.findMany();
  const customers = await prisma.customer.findMany();
  const suppliers = await prisma.supplier.findMany();
  const salesmen = await prisma.salesman.findMany();

  const prod = {}; products.forEach(p => { prod[p.barcode] = p; });
  const cust = {}; customers.forEach(c => { cust[c.name] = c; });
  const sup = {}; suppliers.forEach(s => { sup[s.name] = s.id; });
  const sm = {}; salesmen.forEach(s => { sm[s.name] = s.id; });

  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const threeWeeks = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Helper to get rate-tier price
  function price(barcode, tier) {
    const p = prod[barcode];
    if (!p) return 0;
    if (tier === 'A') return p.rateA;
    if (tier === 'C') return p.rateC || p.sellingPrice;
    return p.rateB || p.sellingPrice;
  }

  const now = new Date().toISOString();
  let invCount = 0, poCount = 0, piCount = 0, iiCount = 0;

  // ── PURCHASES ──
  console.log('\n--- Purchase Invoices ---');

  // PO-1: Rice & Flour from RS Agro Trading
  const po1 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['RS Agro Trading'], invoiceNumber: 'PO-2026-001', date: threeWeeks, dueDate: threeWeeks, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'partial', paymentMethod: 'CASH', notes: 'Monthly rice & flour order', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po1Items = [
    { barcode: '8901234000001', qty: 10, unitCost: 40000 },
    { barcode: '8901234000003', qty: 20, unitCost: 3200 },
    { barcode: '8901234000007', qty: 15, unitCost: 3600 },
  ];
  for (const it of po1Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po1.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-001', expiryDate: null } });
    piCount++;
  }
  const po1Total = po1Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po1.id }, data: { subtotal: Math.round(po1Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po1Total - po1Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po1Total) } });
  console.log(`  ${po1.invoiceNumber}: ₹${Math.round(po1Total)} — 3 items`);

  // PO-2: Dairy from Patel Dairy Farms
  const po2 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['Patel Dairy Farms'], invoiceNumber: 'PO-2026-002', date: lastWeek, dueDate: nextWeek, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'pending', paymentMethod: null, notes: 'Weekly dairy delivery', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po2Items = [
    { barcode: '8901234000009', qty: 60, unitCost: 650 },
    { barcode: '8901234000010', qty: 100, unitCost: 350 },
    { barcode: '8901234000013', qty: 25, unitCost: 2600 },
    { barcode: '8901234000014', qty: 30, unitCost: 450 },
  ];
  for (const it of po2Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po2.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-002', expiryDate: null } });
    piCount++;
  }
  const po2Total = po2Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po2.id }, data: { subtotal: Math.round(po2Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po2Total - po2Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po2Total) } });
  console.log(`  ${po2.invoiceNumber}: ₹${Math.round(po2Total)} — 4 items`);

  // PO-3: Beverages from Beverages World
  const po3 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['Beverages World'], invoiceNumber: 'PO-2026-003', date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), dueDate: new Date(Date.now() - 10 * 86400000 + 15 * 86400000).toISOString().slice(0, 10), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 120000, status: 'partial', paymentMethod: 'UPI', notes: 'Beverage stock replenishment', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po3Items = [
    { barcode: '8901234000017', qty: 40, unitCost: 450 },
    { barcode: '8901234000018', qty: 35, unitCost: 450 },
    { barcode: '8901234000022', qty: 20, unitCost: 1100 },
    { barcode: '8901234000023', qty: 50, unitCost: 1700 },
  ];
  for (const it of po3Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po3.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-003', expiryDate: null } });
    piCount++;
  }
  const po3Total = po3Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po3.id }, data: { subtotal: Math.round(po3Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po3Total - po3Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po3Total) } });
  console.log(`  ${po3.invoiceNumber}: ₹${Math.round(po3Total)} — 4 items`);

  // PO-4: Spices from Spice Route India
  const po4 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['Spice Route India'], invoiceNumber: 'PO-2026-004', date: twoWeeks, dueDate: twoWeeks, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'paid', paymentMethod: 'CASH', notes: 'Spice order', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po4Items = [
    { barcode: '8901234000070', qty: 80, unitCost: 70 },
    { barcode: '8901234000071', qty: 50, unitCost: 110 },
    { barcode: '8901234000073', qty: 30, unitCost: 140 },
    { barcode: '8901234000074', qty: 25, unitCost: 180 },
  ];
  for (const it of po4Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po4.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-004', expiryDate: null } });
    piCount++;
  }
  const po4Total = po4Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po4.id }, data: { subtotal: Math.round(po4Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po4Total - po4Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po4Total) } });
  console.log(`  ${po4.invoiceNumber}: ₹${Math.round(po4Total)} — 4 items`);

  // PO-5: Frozen from RS Agro Trading
  const po5 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['RS Agro Trading'], invoiceNumber: 'PO-2026-005', date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), dueDate: new Date(Date.now() - 15 * 86400000 + 15 * 86400000).toISOString().slice(0, 10), subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'paid', paymentMethod: 'UPI', notes: 'Frozen foods order', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po5Items = [
    { barcode: '8901234000036', qty: 12, unitCost: 1600 },
    { barcode: '8901234000037', qty: 15, unitCost: 1000 },
    { barcode: '8901234000038', qty: 10, unitCost: 5500 },
  ];
  for (const it of po5Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po5.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-005', expiryDate: null } });
    piCount++;
  }
  const po5Total = po5Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po5.id }, data: { subtotal: Math.round(po5Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po5Total - po5Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po5Total) } });
  console.log(`  ${po5.invoiceNumber}: ₹${Math.round(po5Total)} — 3 items`);

  // PO-6: Household from Clean Home Products
  const po6 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['Clean Home Products'], invoiceNumber: 'PO-2026-006', date: lastWeek, dueDate: nextWeek, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'partial', paymentMethod: 'CASH', notes: 'Household supplies restock', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po6Items = [
    { barcode: '8901234000054', qty: 20, unitCost: 850 },
    { barcode: '8901234000056', qty: 20, unitCost: 600 },
    { barcode: '8901234000057', qty: 25, unitCost: 400 },
  ];
  for (const it of po6Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po6.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-006', expiryDate: null } });
    piCount++;
  }
  const po6Total = po6Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po6.id }, data: { subtotal: Math.round(po6Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po6Total - po6Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po6Total) } });
  console.log(`  ${po6.invoiceNumber}: ₹${Math.round(po6Total)} — 3 items`);

  // PO-7: Personal Care from Harvest Fresh Fruits
  const po7 = await prisma.purchaseInvoice.create({
    data: { supplierId: sup['Harvest Fresh Fruits'], invoiceNumber: 'PO-2026-007', date: today, dueDate: nextWeek, subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, status: 'pending', paymentMethod: null, notes: 'Personal care restock', createdBy: 'admin', createdAt: now, updatedAt: now }
  });
  poCount++;
  const po7Items = [
    { barcode: '8901234000059', qty: 20, unitCost: 2300 },
    { barcode: '8901234000060', qty: 25, unitCost: 1400 },
    { barcode: '8901234000062', qty: 15, unitCost: 1800 },
  ];
  for (const it of po7Items) {
    const p = prod[it.barcode];
    const lineTotal = it.qty * it.unitCost;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    await prisma.purchaseItem.create({ data: { purchaseInvoiceId: po7.id, productId: p.id, name: p.name, quantity: it.qty, unitCost: it.unitCost, discountType: null, discountValue: 0, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax, batchNumber: p.category + '-007', expiryDate: null } });
    piCount++;
  }
  const po7Total = po7Items.reduce((s, it) => { const p = prod[it.barcode]; return s + it.qty * it.unitCost * (1 + p.taxRate / 100); }, 0);
  await prisma.purchaseInvoice.update({ where: { id: po7.id }, data: { subtotal: Math.round(po7Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), taxAmount: Math.round(po7Total - po7Items.reduce((s, it) => s + it.qty * it.unitCost, 0)), totalAmount: Math.round(po7Total) } });
  console.log(`  ${po7.invoiceNumber}: ₹${Math.round(po7Total)} — 3 items`);

  // ── SALES ──
  console.log('\n--- Sales Invoices ---');

  // INV-1: Ram Lal, cash
  const inv1 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-101', customerId: cust['Ram Lal'].id, customerName: 'Ram Lal', customerPhone: '9876543101', salesmanId: sm['Rajesh Kumar'], subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv1Items = [
    { barcode: '8901234000001', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000009', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000044', qty: 1, tier: 'B', discountType: null, discountValue: 0 },
  ];
  let inv1Sub = 0, inv1Tax = 0;
  for (const it of inv1Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv1Sub += lineTotal; inv1Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv1.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  await prisma.invoice.update({ where: { id: inv1.id }, data: { subtotal: Math.round(inv1Sub), taxAmount: inv1Tax, totalAmount: Math.round(inv1Sub + inv1Tax), amountPaid: Math.round(inv1Sub + inv1Tax) } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv1.id, method: 'CASH', amount: Math.round(inv1Sub + inv1Tax) } });
  console.log(`  ${inv1.invoiceNumber}: ₹${Math.round(inv1Sub + inv1Tax)} — Ram Lal — CASH — PAID`);

  // INV-2: Sunita Devi (A-tier wholesale credit), partial UPI payment
  const inv2 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-102', customerId: cust['Sunita Devi'].id, customerName: 'Sunita Devi', customerPhone: '9876543102', salesmanId: sm['Priya Sharma'], subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv2Items = [
    { barcode: '8901234000001', qty: 10, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000004', qty: 5, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000017', qty: 20, tier: 'A', discountType: null, discountValue: 0 },
  ];
  let inv2Sub = 0, inv2Tax = 0;
  for (const it of inv2Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv2Sub += lineTotal; inv2Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv2.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  const inv2Total = Math.round(inv2Sub + inv2Tax);
  const inv2Paid = Math.round(inv2Total * 0.7); // 70% paid by UPI
  const inv2Due = inv2Total - inv2Paid;
  await prisma.invoice.update({ where: { id: inv2.id }, data: { subtotal: Math.round(inv2Sub), taxAmount: inv2Tax, totalAmount: inv2Total, amountPaid: inv2Paid, dueAmount: inv2Due, paymentMethod: 'UPI' } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv2.id, method: 'UPI', amount: inv2Paid } });
  console.log(`  ${inv2.invoiceNumber}: ₹${inv2Total} — Sunita Devi — UPI — PARTIAL (₹${inv2Paid} paid, ₹${inv2Due} due)`);

  // INV-3: Ramesh Babu (C-tier), cash
  const inv3 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-103', customerId: cust['Ramesh Babu'].id, customerName: 'Ramesh Babu', customerPhone: '9876543103', salesmanId: sm['Rajesh Kumar'], subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv3Items = [
    { barcode: '8901234000028', qty: 3, tier: 'C', discountType: null, discountValue: 0 },
    { barcode: '8901234000030', qty: 1, tier: 'C', discountType: null, discountValue: 0 },
    { barcode: '8901234000051', qty: 2, tier: 'C', discountType: null, discountValue: 0 },
    { barcode: '8901234000064', qty: 1, tier: 'C', discountType: null, discountValue: 0 },
  ];
  let inv3Sub = 0, inv3Tax = 0;
  for (const it of inv3Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv3Sub += lineTotal; inv3Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv3.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  await prisma.invoice.update({ where: { id: inv3.id }, data: { subtotal: Math.round(inv3Sub), taxAmount: inv3Tax, totalAmount: Math.round(inv3Sub + inv3Tax), amountPaid: Math.round(inv3Sub + inv3Tax) } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv3.id, method: 'CASH', amount: Math.round(inv3Sub + inv3Tax) } });
  console.log(`  ${inv3.invoiceNumber}: ₹${Math.round(inv3Sub + inv3Tax)} — Ramesh Babu — CASH — PAID`);

  // INV-4: Lakshmi Bai (B-tier, credit/some due), UPI partial
  const inv4 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-104', customerId: cust['Lakshmi Bai'].id, customerName: 'Lakshmi Bai', customerPhone: '9876543104', salesmanId: sm['Mohan Das'].id, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv4Items = [
    { barcode: '8901234000002', qty: 5, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000011', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000017', qty: 10, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000020', qty: 5, tier: 'B', discountType: null, discountValue: 0 },
  ];
  let inv4Sub = 0, inv4Tax = 0;
  for (const it of inv4Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv4Sub += lineTotal; inv4Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv4.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  const inv4Total = Math.round(inv4Sub + inv4Tax);
  const inv4Paid = Math.round(inv4Total * 0.6); // 60% paid by UPI
  const inv4Due = inv4Total - inv4Paid;
  await prisma.invoice.update({ where: { id: inv4.id }, data: { subtotal: Math.round(inv4Sub), taxAmount: inv4Tax, totalAmount: inv4Total, amountPaid: inv4Paid, dueAmount: inv4Due, paymentMethod: 'UPI' } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv4.id, method: 'UPI', amount: inv4Paid } });
  console.log(`  ${inv4.invoiceNumber}: ₹${inv4Total} — Lakshmi Bai — UPI — PARTIAL (₹${inv4Paid} paid, ₹${inv4Due} due)`);

  // INV-5: Krishna Murthy (big A-tier spender), UPI
  const inv5 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-105', customerId: cust['Krishna Murthy'].id, customerName: 'Krishna Murthy', customerPhone: '9876543105', salesmanId: sm['Rajesh Kumar'], subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv5Items = [
    { barcode: '8901234000001', qty: 20, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000002', qty: 10, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000009', qty: 30, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000013', qty: 5, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000023', qty: 10, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000045', qty: 5, tier: 'A', discountType: null, discountValue: 0 },
    { barcode: '8901234000064', qty: 3, tier: 'A', discountType: null, discountValue: 0 },
  ];
  let inv5Sub = 0, inv5Tax = 0;
  for (const it of inv5Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv5Sub += lineTotal; inv5Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv5.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  await prisma.invoice.update({ where: { id: inv5.id }, data: { subtotal: Math.round(inv5Sub), taxAmount: inv5Tax, totalAmount: Math.round(inv5Sub + inv5Tax), amountPaid: Math.round(inv5Sub + inv5Tax) } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv5.id, method: 'UPI', amount: Math.round(inv5Sub + inv5Tax) } });
  console.log(`  ${inv5.invoiceNumber}: ₹${Math.round(inv5Sub + inv5Tax)} — Krishna Murthy — UPI — PAID`);

  // INV-6: Padmaja Garu, cash, yesterday
  const inv6 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-106', customerId: cust['Padmaja Garu'].id, customerName: 'Padmaja Garu', customerPhone: '9876543106', salesmanId: sm['Priya Sharma'].id, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: new Date(Date.now() - 86400000).toISOString() }
  });
  invCount++;
  const inv6Items = [
    { barcode: '8901234000010', qty: 6, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000040', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000044', qty: 1, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000054', qty: 1, tier: 'B', discountType: null, discountValue: 0 },
  ];
  let inv6Sub = 0, inv6Tax = 0;
  for (const it of inv6Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv6Sub += lineTotal; inv6Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv6.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  await prisma.invoice.update({ where: { id: inv6.id }, data: { subtotal: Math.round(inv6Sub), taxAmount: inv6Tax, totalAmount: Math.round(inv6Sub + inv6Tax), amountPaid: Math.round(inv6Sub + inv6Tax) } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv6.id, method: 'CASH', amount: Math.round(inv6Sub + inv6Tax) } });
  console.log(`  ${inv6.invoiceNumber}: ₹${Math.round(inv6Sub + inv6Tax)} — Padmaja Garu — CASH — PAID`);

  // INV-7: Suresh Reddy, cash, yesterday (small bill)
  const inv7 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-107', customerId: cust['Suresh Reddy'].id, customerName: 'Suresh Reddy', customerPhone: '9876543107', salesmanId: sm['Priya Sharma'].id, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: new Date(Date.now() - 86400000).toISOString() }
  });
  invCount++;
  const inv7Items = [
    { barcode: '8901234000034', qty: 3, tier: 'C', discountType: null, discountValue: 0 },
    { barcode: '8901234000028', qty: 5, tier: 'C', discountType: null, discountValue: 0 },
    { barcode: '8901234000078', qty: 3, tier: 'C', discountType: null, discountValue: 0 },
  ];
  let inv7Sub = 0, inv7Tax = 0;
  for (const it of inv7Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv7Sub += lineTotal; inv7Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv7.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  await prisma.invoice.update({ where: { id: inv7.id }, data: { subtotal: Math.round(inv7Sub), taxAmount: inv7Tax, totalAmount: Math.round(inv7Sub + inv7Tax), amountPaid: Math.round(inv7Sub + inv7Tax) } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv7.id, method: 'CASH', amount: Math.round(inv7Sub + inv7Tax) } });
  console.log(`  ${inv7.invoiceNumber}: ₹${Math.round(inv7Sub + inv7Tax)} — Suresh Reddy — CASH — PAID`);

  // INV-8: Anitha K (B-tier, credit), UPI partial
  const inv8 = await prisma.invoice.create({
    data: { invoiceNumber: 'INV-2026-108', customerId: cust['Anitha K'].id, customerName: 'Anitha K', customerPhone: '9876543108', salesmanId: sm['Rajesh Kumar'].id, subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0, totalAmount: 0, paymentMethod: 'UPI', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0, returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0, createdAt: now }
  });
  invCount++;
  const inv8Items = [
    { barcode: '8901234000009', qty: 3, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000014', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000046', qty: 2, tier: 'B', discountType: null, discountValue: 0 },
    { barcode: '8901234000054', qty: 1, tier: 'B', discountType: null, discountValue: 0 },
  ];
  let inv8Sub = 0, inv8Tax = 0;
  for (const it of inv8Items) {
    const p = prod[it.barcode];
    const pr = price(it.barcode, it.tier);
    const lineTotal = pr * it.qty;
    const lineTax = Math.round(lineTotal * p.taxRate / 100);
    inv8Sub += lineTotal; inv8Tax += lineTax;
    await prisma.invoiceItem.create({ data: { invoiceId: inv8.id, productId: p.id, name: p.name, unit: p.unit, rateTier: it.tier, quantity: it.qty, price: pr, discountType: it.discountType, discountValue: it.discountValue, taxRate: p.taxRate, taxAmount: lineTax, total: lineTotal + lineTax } });
    iiCount++;
  }
  const inv8Total = Math.round(inv8Sub + inv8Tax);
  const inv8Paid = Math.round(inv8Total * 0.5); // 50% paid by UPI
  const inv8Due = inv8Total - inv8Paid;
  await prisma.invoice.update({ where: { id: inv8.id }, data: { subtotal: Math.round(inv8Sub), taxAmount: inv8Tax, totalAmount: inv8Total, amountPaid: inv8Paid, dueAmount: inv8Due, paymentMethod: 'UPI' } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv8.id, method: 'UPI', amount: inv8Paid } });
  console.log(`  ${inv8.invoiceNumber}: ₹${inv8Total} — Anitha K — UPI — PARTIAL (₹${inv8Paid} paid, ₹${inv8Due} due)`);

  // ── UPDATE STOCK: deduct sales ──
  console.log('\n=== Updating stock (deducting sales) ===');
  const allSold = await prisma.invoiceItem.findMany({ select: { productId: true, quantity: true } });
  for (const item of allSold) {
    await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
  }
  console.log(`Deducted ${allSold.length} line items from stock`);

  // ── FINAL SUMMARY ──
  const totalPO = await prisma.purchaseInvoice.count();
  const totalInv = await prisma.invoice.count();
  const totalPI = await prisma.purchaseItem.count();
  const totalII = await prisma.invoiceItem.count();
  const totalPay = await prisma.invoicePayment.count();
  const totalStock = (await prisma.product.aggregate({ _sum: { stock: true } }))._sum.stock;
  const lowStock = await prisma.product.count({ where: { stock: { lte: 5 } } });
  const totalPurchaseAmt = (await prisma.purchaseInvoice.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount || 0;
  const totalSalesAmt = (await prisma.invoice.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount || 0;

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Purchase Invoices: ${totalPO} (₹${Math.round(totalPurchaseAmt)} total)`);
  console.log(`  Purchase Items: ${totalPI}`);
  console.log(`Sales Invoices: ${totalInv} (₹${Math.round(totalSalesAmt)} total)`);
  console.log(`  Invoice Items: ${totalII}`);
  console.log(`  Payments: ${totalPay}`);
  console.log('');
  console.log(`Products: ${products.length}`);
  console.log(`Total stock: ${totalStock}`);
  console.log(`Low-stock items (≤5): ${lowStock}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Suppliers: ${suppliers.length}`);
  console.log(`Salesmen: ${salesmen.length}`);
  console.log('\nCustomers with outstanding dues:');
  for (const c of customers) {
    const custInvoices = await prisma.invoice.findMany({ where: { customerId: c.id, dueAmount: { gt: 0 } } });
    const totalDue = custInvoices.reduce((s, i) => s + i.dueAmount, 0);
    if (totalDue > 0) console.log(`  ${c.name}: ₹${totalDue} due (${custInvoices.length} invoices)`);
  }
  console.log('\n=== Seed Complete ===');

  await prisma.$disconnect();
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
