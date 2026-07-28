const express = require('express');
const prisma = require('../lib/prisma');
const acct = require('../lib/accounting');
const { requireAuth } = require('../middleware/auth');
const { findLedgerByPurpose } = require('../lib/accounting');

const router = express.Router();
router.use(requireAuth);

// ─── Account Groups ──────────────────────────────────────────────────

// GET /groups — list all groups, nested as a tree
router.get('/groups', async (req, res) => {
  try {
    const groups = await prisma.accountGroup.findMany({ orderBy: { code: 'asc' } });
    const map = new Map();
    groups.forEach((g) => map.set(g.id, { ...g, children: [] }));
    const roots = [];
    for (const g of map.values()) {
      if (g.parentId && map.has(g.parentId)) {
        map.get(g.parentId).children.push(g);
      } else {
        roots.push(g);
      }
    }
    res.json(roots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /groups
router.post('/groups', async (req, res) => {
  try {
    const { code, name, parentId, nature, reportType } = req.body;
    const group = await prisma.accountGroup.create({
      data: { code, name, parentId: parentId || null, nature, reportType },
    });
    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /groups/:id
router.put('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid group id' });
    const { code, name, parentId, nature, reportType } = req.body;
    const group = await prisma.accountGroup.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(nature !== undefined && { nature }),
        ...(reportType !== undefined && { reportType }),
      },
    });
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /groups/:id — reject if isSystem
router.delete('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid group id' });
    const group = await prisma.accountGroup.findUnique({ where: { id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.isSystem) return res.status(400).json({ error: 'Cannot delete a system group' });
    await prisma.accountGroup.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Ledgers ─────────────────────────────────────────────────────────

// GET /ledgers — list all ledgers with group info
router.get('/ledgers', async (req, res) => {
  try {
    const ledgers = await prisma.ledger.findMany({
      include: { group: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(ledgers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ledgers
router.post('/ledgers', async (req, res) => {
  try {
    const { name, groupId, openingDebit, openingCredit, linkedEntityType, linkedEntityId } = req.body;
    const ledger = await prisma.ledger.create({
      data: {
        name,
        groupId,
        openingDebit: openingDebit || 0,
        openingCredit: openingCredit || 0,
        linkedEntityType: linkedEntityType || null,
        linkedEntityId: linkedEntityId || null,
      },
    });
    res.status(201).json(ledger);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /ledgers/:id
router.put('/ledgers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ledger id' });
    const { name, groupId, openingDebit, openingCredit, linkedEntityType, linkedEntityId } = req.body;
    const ledger = await prisma.ledger.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(groupId !== undefined && { groupId }),
        ...(openingDebit !== undefined && { openingDebit }),
        ...(openingCredit !== undefined && { openingCredit }),
        ...(linkedEntityType !== undefined && { linkedEntityType: linkedEntityType || null }),
        ...(linkedEntityId !== undefined && { linkedEntityId: linkedEntityId || null }),
      },
    });
    res.json(ledger);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /ledgers/:id — reject if isSystem
router.delete('/ledgers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ledger id' });
    const ledger = await prisma.ledger.findUnique({ where: { id } });
    if (!ledger) return res.status(404).json({ error: 'Ledger not found' });
    if (ledger.isSystem) return res.status(400).json({ error: 'Cannot delete a system ledger' });
    await prisma.ledger.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Journals ────────────────────────────────────────────────────────

// GET /journals — list journals with optional filters
router.get('/journals', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const where = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (type) where.type = type;
    const journals = await prisma.journal.findMany({
      where,
      include: { lines: { include: { ledger: { select: { id: true, name: true } } } } },
      orderBy: { date: 'desc' },
      take: limit,
    });
    res.json(journals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /journals — post a journal entry via accounting lib
router.post('/journals', async (req, res) => {
  try {
    const { date, type, narration, referenceType, referenceId, lines } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'A journal must have at least two lines' });
    }
    const journal = await acct.postJournal({
      date: new Date(date),
      type,
      narration: narration || null,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      createdBy: req.user.id,
      lines,
    });
    res.status(201).json(journal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /journals/:id — single journal with lines
router.get('/journals/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid journal id' });
    const journal = await prisma.journal.findUnique({
      where: { id },
      include: { lines: { include: { ledger: { select: { id: true, name: true } } } } },
    });
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    res.json(journal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Financial Reports ───────────────────────────────────────────────

// GET /trial-balance
router.get('/trial-balance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await acct.getTrialBalance(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /profit-loss
router.get('/profit-loss', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await acct.getProfitAndLoss(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /balance-sheet
router.get('/balance-sheet', async (req, res) => {
  try {
    const { asOf } = req.query;
    const result = await acct.getBalanceSheet(
      asOf ? new Date(asOf) : undefined,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /cash-flow
router.get('/cash-flow', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await acct.getCashFlow(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /receivables
router.get('/receivables', async (req, res) => {
  try {
    const result = await acct.getAccountsReceivable();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /payables
router.get('/payables', async (req, res) => {
  try {
    const result = await acct.getAccountsPayable();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Expenses ────────────────────────────────────────────────────────

// POST /expenses — create expense and auto-post journal
router.post('/expenses', async (req, res) => {
  try {
    const { date, ledgerId, amount, paymentMode, bankLedgerId, reference, narration, partyName } = req.body;
    if (!date || !ledgerId || !amount || !paymentMode) {
      return res.status(400).json({ error: 'date, ledgerId, amount, and paymentMode are required' });
    }
    const journalType = paymentMode === 'bank' ? 'payment' : 'journal';
      // Determine the credit side ledger: bank ledger if bank payment, otherwise cash ledger
    let creditLedgerId = bankLedgerId;
    if (paymentMode !== 'bank') {
      const cashLedger = await findLedgerByPurpose('cash');
      if (!cashLedger) return res.status(400).json({ error: 'Cash ledger not found. Run seed first.' });
      creditLedgerId = cashLedger.id;
    } else if (!creditLedgerId) {
      return res.status(400).json({ error: 'bankLedgerId is required for bank payments' });
    }

    const journal = await acct.postJournal({
      date: new Date(date),
      type: journalType,
      narration: narration || `Expense: ${partyName || ''}`,
      referenceType: 'expense',
      referenceId: null,
      createdBy: req.user.id,
      lines: [
        { ledgerId, debit: amount, credit: 0 },
        { ledgerId: creditLedgerId, debit: 0, credit: amount },
      ],
    });

    const expense = await prisma.expense.create({
      data: {
        date: new Date(date),
        ledgerId,
        amount,
        paymentMode,
        bankLedgerId: bankLedgerId || null,
        reference: reference || null,
        narration: narration || null,
        partyName: partyName || null,
        createdBy: req.user.id,
      },
    });

    res.status(201).json({ expense, journal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /expenses — list expenses with optional date range
router.get('/expenses', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    const expenses = await prisma.expense.findMany({
      where,
      include: { ledger: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Bank Reconciliation ─────────────────────────────────────────────

// POST /bank-reconciliation — mark a journal as reconciled
router.post('/bank-reconciliation', async (req, res) => {
  try {
    const { journalId, statementDate, statementRef, reconciled } = req.body;
    if (!journalId || !statementDate) {
      return res.status(400).json({ error: 'journalId and statementDate are required' });
    }
    // Fetch journal to get total for the amount field
    const journal = await prisma.journal.findUnique({ where: { id: journalId } });
    if (!journal) return res.status(404).json({ error: 'Journal not found' });

    const entry = await prisma.bankReconciliation.upsert({
      where: { journalId },
      create: {
        journalId,
        statementDate: new Date(statementDate),
        statementRef: statementRef || null,
        reconciled: reconciled !== false,
        reconciledAt: reconciled !== false ? new Date() : null,
        amount: journal.totalDebit || journal.totalCredit,
      },
      update: {
        statementDate: new Date(statementDate),
        statementRef: statementRef || null,
        reconciled: reconciled !== false,
        reconciledAt: reconciled !== false ? new Date() : null,
      },
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /bank-reconciliation — list unreconciled items
router.get('/bank-reconciliation', async (req, res) => {
  try {
    const items = await prisma.bankReconciliation.findMany({
      where: { reconciled: false },
      include: { journal: true },
      orderBy: { statementDate: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Cost Centers ────────────────────────────────────────────────────

// GET /cost-centers
router.get('/cost-centers', async (req, res) => {
  try {
    const centers = await prisma.costCenter.findMany({ orderBy: { name: 'asc' } });
    res.json(centers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /cost-centers
router.post('/cost-centers', async (req, res) => {
  try {
    const { name, code } = req.body;
    const center = await prisma.costCenter.create({ data: { name, code: code || null } });
    res.status(201).json(center);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /cost-centers/:id
router.put('/cost-centers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid cost center id' });
    const { name, code } = req.body;
    const center = await prisma.costCenter.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
      },
    });
    res.json(center);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /cost-centers/:id
router.delete('/cost-centers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid cost center id' });
    await prisma.costCenter.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Seed & Financial Years ──────────────────────────────────────────

// POST /seed — seed the default chart of accounts
router.post('/seed', async (req, res) => {
  try {
    await acct.seedChartOfAccounts();
    res.json({ success: true, message: 'Chart of accounts seeded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /financial-years
router.get('/financial-years', async (req, res) => {
  try {
    const years = await prisma.financialYear.findMany({ orderBy: { startDate: 'desc' } });
    res.json(years);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /financial-years
router.post('/financial-years', async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate, and endDate are required' });
    }
    const year = await prisma.financialYear.create({
      data: { name, startDate: new Date(startDate), endDate: new Date(endDate) },
    });
    res.status(201).json(year);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
