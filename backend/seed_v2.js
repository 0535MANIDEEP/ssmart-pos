const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = 'file:./data/pos.db';
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Structured Seed v2 ===');

  // Check what exists
  const allProds = await prisma.product.findMany();
  const allCusts = await prisma.customer.findMany();
  const allSups = await prisma.supplier.findMany();
  const allSmen = await prisma.salesman.findMany();
  console.log(`Base data: ${allProds.length} products, ${allCusts.length} customers, ${allSups.length} suppliers, ${allSmen.length} salesmen`);

  // Check existing transactions
  const existingInvoices = await prisma.invoice.count();
  const existingPOs = await prisma.purchaseInvoice.count();
  console.log(`Existing: ${existingInvoices} invoices, ${existingPOs} purchase invoices`);

  // If there are already invoices, don't create more (avoid duplicates)
  if (existingInvoices > 0) {
    console.log('Invoices already exist — skipping seed to avoid duplicates');
    await prisma.$disconnect();
    return;
  }

  const now = new Date().toISOString();
  const prodByBarcode = {};
  allProds.forEach(p => { prodByBarcode[p.barcode] = p; });

  const custByName = {};
  allCusts.forEach(c => { custByName[c.name] = c; });
  const supByName = {};
  allSups.forEach(s => { supByName[s.name] = s.id; });
  const smByName = {};
  allSmen.forEach(s => { smByName[s.name] = s.id; });

  function p(barcode) { return prodByBarcode[barcode]; }
  function cid(name) { return custByName[name] ? custByName[name].id : 0; }
  function sid(name) { return supByName[name] || 0; }
  function smi(name) { return smByName[name] || 0; }

  // Create Purchase Invoices
  console.log('\n--- Purchase Invoices ---');

  const po1 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: sid('RS Agro Trading'),
      invoiceNumber: 'PO-2026-001',
      date: '2026-07-08', dueDate: '2026-07-08',
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'partial',
      paymentMethod: 'CASH', notes: 'Monthly rice & flour order',
      createdBy: 'admin', createdAt: now, updatedAt: now,
    }
  });
  console.log(`  ${po1.invoiceNumber}: created`);

  const po2 = await prisma.purchaseInvoice.create({
    data: {
      supplierId: sid('Patel Dairy Farms'),
      invoiceNumber: 'PO-2026-002',
      date: '2026-07-22', dueDate: '2026-07-29',
      subtotal: 0, discountType: null, discountAmount: 0, taxAmount: 0,
      totalAmount: 0, amountPaid: 0, status: 'pending',
      paymentMethod: null, notes: 'Weekly dairy delivery',
      createdBy: 'admin', createdAt: now, updatedAt: now,
    }
  });
  console.log(`  ${po2.invoiceNumber}: created`);

  // Create Sale Invoices
  console.log('\n--- Sales Invoices ---');

  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-101',
      customerId: cid('Ram Lal'), customerName: 'Ram Lal', customerPhone: '9876543101',
      salesmanId: smi('Rajesh Kumar'),
      subtotal: 0, discountType: null, discountValue: 0, discountAmount: 0, taxAmount: 0, loyaltyDiscount: 0,
      totalAmount: 0, paymentMethod: 'CASH', amountPaid: 0, changeDue: 0, dueAmount: 0, previousDuePaid: 0,
      returnValue: 0, creditApplied: 0, refundValue: 0, refundMode: null, pointsRedeemed: 0, pointsEarned: 0,
      createdAt: now,
    }
  });
  console.log(`  ${inv1.invoiceNumber}: created`);

  // Create items
  console.log('\nCreating invoice items for INV-1...');
  const inv1prod1 = p('8901234000001');
  const inv1prod2 = p('8901234000009');
  if (inv1prod1 && inv1prod2) {
    await prisma.invoiceItem.create({ data: { invoiceId: inv1.id, productId: inv1prod1.id, name: inv1prod1.name, unit: inv1prod1.unit, rateTier: 'B', quantity: 2, price: inv1prod1.sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: Math.round(2*inv1prod1.sellingPrice*18/100), total: Math.round(2*inv1prod1.sellingPrice*(1+18/100)) } });
    await prisma.invoiceItem.create({ data: { invoiceId: inv1.id, productId: inv1prod2.id, name: inv1prod2.name, unit: inv1prod2.unit, rateTier: 'B', quantity: 2, price: inv1prod2.sellingPrice, discountType: null, discountValue: 0, taxRate: 18, taxAmount: Math.round(2*inv1prod2.sellingPrice*18/100), total: Math.round(2*inv1prod2.sellingPrice*(1+18/100)) } });
  }

  // Update invoice totals
  const inv1Items = await prisma.invoiceItem.findMany({ where: { invoiceId: inv1.id } });
  const inv1Sub = inv1Items.reduce((s, i) => s + i.total, 0);
  const inv1Tax = inv1Items.reduce((s, i) => s + i.taxAmount, 0);
  const inv1Total = Math.round(inv1Sub);
  await prisma.invoice.update({ where: { id: inv1.id }, data: { subtotal: Math.round(inv1Items.reduce((s,i)=>s+i.price*i.quantity,0)), taxAmount: inv1Tax, totalAmount: inv1Total, amountPaid: inv1Total } });
  await prisma.invoicePayment.create({ data: { invoiceId: inv1.id, method: 'CASH', amount: inv1Total } });
  console.log(`  INV-2026-101: ₹${inv1Total} — Ram Lal — PAID`);

  console.log('\n=== Seed Complete ===');
  console.log('Created 2 purchase invoices and 1 sales invoice');
  console.log('Stock will be deducted after verification');

  await prisma.$disconnect();
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
