const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const packingSchema = z.object({
  bulkProductId: z.number().int().positive(),
  packProductId: z.number().int().positive(),
  packWeight: z.number().positive(),
  packLabel: z.string().trim().min(1).max(30),
  mrp: z.number().positive(),
  sellingPrice: z.number().positive(),
  purchasePrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
  active: z.boolean().optional().default(true),
});

// GET /api/packing — list all packings
router.get('/', async (req, res) => {
  const packings = await prisma.packing.findMany({
    where: { active: true },
    include: {
      bulkProduct: { select: { id: true, name: true, barcode: true, unit: true, stock: true, purchasePrice: true } },
      packProduct: { select: { id: true, name: true, barcode: true, unit: true, stock: true, purchasePrice: true, sellingPrice: true, rateA: true, rateB: true, rateC: true, taxRate: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(packings);
});

// GET /api/packing/:id
router.get('/:id', async (req, res) => {
  const packing = await prisma.packing.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      bulkProduct: { select: { id: true, name: true, barcode: true, unit: true, stock: true, purchasePrice: true } },
      packProduct: { select: { id: true, name: true, barcode: true, unit: true, stock: true, purchasePrice: true, sellingPrice: true } },
    },
  });
  if (!packing) return res.status(404).json({ error: 'Packing not found' });
  res.json(packing);
});

// GET /api/packing/bulk/:bulkId/packs — all packs for a bulk product
router.get('/bulk/:bulkId', async (req, res) => {
  const bulkId = Number(req.params.bulkId);
  const packings = await prisma.packing.findMany({
    where: { bulkProductId: bulkId, active: true },
    include: {
      packProduct: { select: { id: true, name: true, barcode: true, unit: true, stock: true, purchasePrice: true, sellingPrice: true, rateA: true, rateB: true, rateC: true, taxRate: true } },
    },
    orderBy: { packWeight: 'asc' },
  });
  res.json(packings);
});

// POST /api/packing — create a packing record
router.post('/', async (req, res) => {
  const parsed = packingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
  try {
    const packing = await prisma.packing.create({ data: parsed.data });
    const result = await prisma.packing.findUnique({
      where: { id: packing.id },
      include: { bulkProduct: { select: { id: true, name: true } }, packProduct: { select: { id: true, name: true } } },
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'This pack variant already exists for this bulk item' });
    throw e;
  }
});

// PUT /api/packing/:id
router.put('/:id', async (req, res) => {
  const parsed = packingSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
  try {
    const packing = await prisma.packing.update({ where: { id: Number(req.params.id) }, data: parsed.data });
    res.json(packing);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Packing not found' });
    throw e;
  }
});

// DELETE /api/packing/:id — deactivate (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.packing.update({ where: { id: Number(req.params.id) }, data: { active: false } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Packing not found' });
    throw e;
  }
});

// POST /api/packing/:id/create-packs — create pack products from bulk
// This creates actual Product records for each pack variant
router.post('/:id/create-packs', async (req, res) => {
  const packing = await prisma.packing.findUnique({ where: { id: Number(req.params.id) } });
  if (!packing) return res.status(404).json({ error: 'Packing not found' });
  const { packCount, qtyPerPack } = req.body; // e.g. from 5 units bulk, create 10 packs of 500g
  if (!packCount || packCount < 1) return res.status(400).json({ error: 'packCount is required and must be >= 1' });

  const bulkProduct = await prisma.product.findUnique({ where: { id: packing.bulkProductId } });
  if (!bulkProduct) return res.status(404).json({ error: 'Bulk product not found' });
  if (bulkProduct.stock < qtyPerPack * packCount) {
    return res.status(400).json({ error: `Insufficient bulk stock. Have ${bulkProduct.stock}, need ${qtyPerPack * packCount}` });
  }

  const packProduct = await prisma.product.findUnique({ where: { id: packing.packProductId } });
  if (!packProduct) return res.status(404).json({ error: 'Pack product not found' });

  // Deduct bulk stock, add pack stock, sync pack product prices from packing config
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: packing.bulkProductId },
      data: { stock: { decrement: qtyPerPack * packCount } },
    });
    const updatedPack = await tx.product.update({
      where: { id: packing.packProductId },
      data: { stock: { increment: packCount }, mrp: packing.mrp, sellingPrice: packing.sellingPrice, purchasePrice: packing.purchasePrice },
    });
  });

  res.json({ ok: true, bulkUsed: qtyPerPack * packCount, packsCreated: packCount });
});

module.exports = router;
