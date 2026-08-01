const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// No `.default()` here on purpose — see settings.js for why. `.default()`
// fires whenever a key is absent, which would make `productSchema.partial()`
// silently reset taxRate/discountValue/stock to 0 on any partial update
// that omits them (e.g. the Inventory "adjust stock" quick action, which
// only ever sends `{ stock }`). `createSchema` adds the defaults back for
// the POST (create) route, where every field really is required-or-defaulted.
const fields = {
  barcode: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  hsn: z.string().trim().max(20).optional().or(z.literal('')),
  unit: z.string().trim().max(10).optional().or(z.literal('')),
  purchasePrice: z.number().min(0),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  rateA: z.number().min(0).nullish(),
  rateB: z.number().min(0).nullish(),
  rateC: z.number().min(0).nullish(),
  taxRate: z.number().min(0).max(100),
  discountType: z.enum(['percent', 'amount']).nullish(),
  discountValue: z.number().min(0),
  stock: z.number().int().min(0),
  minStock: z.number().int().min(0).optional().default(0),
  expiryDate: z.string().optional().or(z.literal('')).nullable(),
  batchNumber: z.string().trim().max(64).optional().or(z.literal('')).nullable(),
  isBulk: z.boolean().optional().default(false),
  packSize: z.number().min(0).nullish(),
  bulkProductId: z.number().nullish(),
};
const createSchema = z.object({
  ...fields,
  taxRate: fields.taxRate.default(0),
  discountValue: fields.discountValue.default(0),
  stock: fields.stock.default(0),
  minStock: fields.minStock.default(0),
});
const updateSchema = z.object(fields).partial();

function normalizeDiscount(data) {
  if (!data.discountType) {
    if ('discountType' in data || 'discountValue' in data) {
      data.discountType = null;
      data.discountValue = 0;
    }
    return data;
  }
  if (data.discountType === 'percent' && data.discountValue > 100) {
    throw Object.assign(new Error('Percent discount cannot exceed 100'), { status: 400 });
  }
  if (data.discountType === 'amount' && data.sellingPrice != null && data.discountValue > data.sellingPrice) {
    throw Object.assign(new Error('Flat discount cannot exceed the selling price'), { status: 400 });
  }
  return data;
}

// GET /api/products?q=search&category=Foo&bulk=1
router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const category = (req.query.category || '').toString().trim();
  const bulk = req.query.bulk === '1';
  const where = {};
  if (q) where.OR = [{ name: { contains: q } }, { barcode: { contains: q } }, { category: { contains: q } }];
  if (category) where.category = category;
  if (bulk) where.isBulk = true;
  const products = await prisma.product.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { name: 'asc' },
  });
  res.json(products);
});

// GET /api/products/categories — unique category list for filter chips
router.get('/categories', async (req, res) => {
  const categories = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  res.json(categories.map(r => r.category).filter(Boolean));
});

// GET /api/products/low-stock — products at or below minStock threshold
router.get('/low-stock', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isBulk: false, minStock: { gt: 0 }, stock: { lte: prisma.product.fields?.minStock } },
    orderBy: { stock: 'asc' },
  });
  // SQLite can't do stock <= minStock in Prisma, so filter manually
  const all = await prisma.product.findMany({
    where: { isBulk: false, minStock: { gt: 0 } },
    orderBy: { stock: 'asc' },
  });
  const lowStock = all.filter(p => p.stock <= p.minStock);
  res.json({ threshold: 5, products: lowStock });
});

// GET /api/products/:id/last-deals — recent sale rates for a product
router.get('/:id/last-deals', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  const items = await prisma.invoiceItem.findMany({
    where: { productId: id },
    include: { invoice: { select: { invoiceNumber: true, createdAt: true, customerName: true } } },
    orderBy: { id: 'desc' },
    take: 4,
  });
  res.json(items.map(i => ({
    invoiceNumber: i.invoice.invoiceNumber,
    date: i.invoice.createdAt,
    customerName: i.invoice.customerName,
    rateTier: i.rateTier,
    price: i.price,
    quantity: i.quantity,
  })));
});

// GET /api/products/barcode/:code — lookup by barcode
router.get('/barcode/:code', async (req, res) => {
  const code = decodeURIComponent(req.params.code).trim();
  const product = await prisma.product.findUnique({ where: { barcode: code } });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST /api/products — create a new product
router.post('/', async (req, res) => {
  try {
    const parsed = createSchema.parse(req.body);
    normalizeDiscount(parsed);

    // Validate sellingPrice <= mrp
    if (parsed.sellingPrice > parsed.mrp) {
      return res.status(400).json({ error: 'Selling price cannot be higher than MRP' });
    }

    const product = await prisma.product.create({ data: parsed });
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A product with this barcode already exists' });
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

// PUT /api/products/:id — update a product
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  try {
    const parsed = updateSchema.parse(req.body);
    normalizeDiscount(parsed);

    // Validate sellingPrice <= mrp if both are provided
    if (parsed.sellingPrice != null && parsed.mrp != null && parsed.sellingPrice > parsed.mrp) {
      return res.status(400).json({ error: 'Selling price cannot be higher than MRP' });
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    // If only one of mrp/sellingPrice is provided, validate against existing
    if (parsed.sellingPrice != null && parsed.mrp == null && parsed.sellingPrice > existing.mrp) {
      return res.status(400).json({ error: 'Selling price cannot be higher than MRP' });
    }
    if (parsed.mrp != null && parsed.sellingPrice == null && existing.sellingPrice > parsed.mrp) {
      return res.status(400).json({ error: 'Selling price cannot be higher than MRP' });
    }

    const product = await prisma.product.update({ where: { id }, data: parsed });
    res.json(product);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A product with this barcode already exists' });
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid product id' });
  try {
    await prisma.product.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    throw err;
  }
});

module.exports = router;
