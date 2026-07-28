const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

async function cleanupExpiredDrafts() {
  const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.draftBill.deleteMany({
    where: { updatedAt: { lt: expiry } },
  });
}

cleanupExpiredDrafts().catch(() => {});

router.get('/draft', async (req, res) => {
  try {
    const drafts = await prisma.draftBill.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(drafts.map((d) => ({
      id: d.id,
      billId: d.label,
      label: d.label || 'Untitled',
      isHeld: d.isHeld,
      state: JSON.parse(d.state),
      updatedAt: d.updatedAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load drafts' });
  }
});

router.post('/draft', async (req, res) => {
  try {
    const { billId, label, state, isHeld } = req.body;
    const parsedState = typeof state === 'string' ? state : JSON.stringify(state);

    await prisma.draftBill.upsert({
      where: {
        userId_label: {
          userId: req.user.id,
          label: billId || label || 'active',
        },
      },
      create: {
        userId: req.user.id,
        label: billId || label || 'active',
        state: parsedState,
        isHeld: !!isHeld,
      },
      update: {
        state: parsedState,
        isHeld: !!isHeld,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

router.delete('/draft/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const draft = await prisma.draftBill.findUnique({
      where: { id },
    });
    if (!draft || draft.userId !== req.user.id) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    await prisma.draftBill.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

router.post('/draft/:id/hold', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const draft = await prisma.draftBill.findUnique({
      where: { id },
    });
    if (!draft || draft.userId !== req.user.id) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    await prisma.draftBill.update({
      where: { id },
      data: { isHeld: true },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to hold draft' });
  }
});

router.post('/draft/:id/recall', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const draft = await prisma.draftBill.findUnique({
      where: { id },
    });
    if (!draft || draft.userId !== req.user.id) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    await prisma.draftBill.update({
      where: { id },
      data: { isHeld: false },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to recall draft' });
  }
});

module.exports = router;