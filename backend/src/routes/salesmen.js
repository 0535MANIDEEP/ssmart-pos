const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const salesmanSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  code: z.string().trim().min(1).max(30),
  active: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const salesmen = await prisma.salesman.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json(salesmen);
});

router.get('/:id', async (req, res) => {
  const salesman = await prisma.salesman.findUnique({ where: { id: Number(req.params.id) } });
  if (!salesman) return res.status(404).json({ error: 'Salesman not found' });
  res.json(salesman);
});

router.post('/', async (req, res) => {
  const parsed = salesmanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
  try {
    const salesman = await prisma.salesman.create({ data: { name: parsed.data.name, phone: parsed.data.phone || null, code: parsed.data.code } });
    res.json(salesman);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Salesman code already exists' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const parsed = salesmanSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') });
  try {
    const salesman = await prisma.salesman.update({ where: { id: Number(req.params.id) }, data: parsed.data });
    res.json(salesman);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Salesman not found' });
    if (e.code === 'P2002') return res.status(409).json({ error: 'Salesman code already exists' });
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.salesman.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Salesman not found' });
    throw e;
  }
});

module.exports = router;
