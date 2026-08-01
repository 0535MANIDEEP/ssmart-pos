const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const tables = ['Product', 'Customer', 'Supplier', 'Invoice', 'PurchaseInvoice', 'Salesman', 'Packing', 'BillOfMaterial', 'ShopSettings', 'User', 'InvoiceItem', 'PurchaseItem', 'ReturnRecord', 'ReturnItem', 'BomItem'];
  for (const t of tables) {
    try {
      const count = await prisma[t].count();
      console.log(t + ': ' + count);
    } catch(e) { console.log(t + ': ERROR - ' + e.message.split('\n')[0]); }
  }
  await prisma.$disconnect();
})();
