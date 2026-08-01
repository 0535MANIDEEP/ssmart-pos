const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');

const dbUrl = 'file:./data/pos.db';
const backendRoot = path.resolve('D:/Projects/ssmart-pos/backend');
const dbFile = dbUrl.replace('file:', '');
const resolvedDbPath = path.resolve(backendRoot, dbFile);

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    const productCount = await prisma.product.count();
    const customerCount = await prisma.customer.count();
    const supplierCount = await prisma.supplier.count();
    const invoiceCount = await prisma.invoice.count();
    const purchaseCount = await prisma.purchaseInvoice.count();
    const salesmanCount = await prisma.salesman.count();
    console.log('=== Existing Data ===');
    console.log('Products:', productCount);
    console.log('Customers:', customerCount);
    console.log('Suppliers:', supplierCount);
    console.log('Invoices:', invoiceCount);
    console.log('Purchase Invoices:', purchaseCount);
    console.log('Salesmen:', salesmanCount);

    if (productCount > 0) {
      const sample = await prisma.product.findMany({ take: 3 });
      console.log('\n=== Sample Products ===');
      sample.forEach(p => console.log(p.name, '| category:', p.category, '| barcode:', p.barcode, '| stock:', p.stock, '| price:', p.sellingPrice));
    }
    if (customerCount > 0) {
      const samples = await prisma.customer.findMany({ take: 3 });
      console.log('\n=== Sample Customers ===');
      samples.forEach(c => console.log(c.name, '| phone:', c.phone, '| tier:', c.rateTier, '| points:', c.loyaltyPoints));
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
