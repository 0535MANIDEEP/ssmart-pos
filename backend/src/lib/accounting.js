const prisma = require('./prisma');

const VOUCHER_PREFIXES = {
  sales: 'SAL',
  purchase: 'PUR',
  payment: 'PAY',
  receipt: 'REC',
  journal: 'JOU',
  contra: 'CON',
  credit_note: 'CRN',
  debit_note: 'DBN',
};

// ── 1. Financial Year ────────────────────────────────────────────────

async function getCurrentFinancialYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed: Jan=0 … Mar=2, Apr=3

  const fyStartYear = month >= 3 ? year : year - 1;
  const startDate = new Date(fyStartYear, 3, 1); // Apr 1
  const endDate = new Date(fyStartYear + 1, 2, 31); // Mar 31

  const fy = await prisma.financialYear.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
  });
  if (fy) return fy;

  return prisma.financialYear.create({
    data: {
      name: `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
      startDate,
      endDate,
    },
  });
}

// ── 2. Voucher Number ────────────────────────────────────────────────

async function nextVoucherNumber(type) {
  const prefix = VOUCHER_PREFIXES[type];
  if (!prefix) throw new Error(`Unknown voucher type: ${type}`);

  const last = await prisma.journal.findFirst({
    where: { type },
    orderBy: { id: 'desc' },
    select: { voucherNumber: true },
  });

  let seq = 1;
  if (last?.voucherNumber) {
    const match = last.voucherNumber.match(/(\d+)$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ── 3. Post Journal ──────────────────────────────────────────────────

async function postJournal({ date, type, narration, referenceType, referenceId, lines, createdBy }) {
  if (!lines || lines.length === 0) {
    throw new Error('Journal must have at least one line');
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Debit/credit mismatch: debit=${totalDebit}, credit=${totalCredit}`);
  }
  if (totalDebit === 0 && totalCredit === 0) {
    throw new Error('Journal lines must not all be zero');
  }

  const userId = createdBy || 1;

  return prisma.$transaction(async (tx) => {
    const prefix = VOUCHER_PREFIXES[type];
    const last = await tx.journal.findFirst({
      where: { type },
      orderBy: { id: 'desc' },
      select: { voucherNumber: true },
    });

    let seq = 1;
    if (last?.voucherNumber) {
      const match = last.voucherNumber.match(/(\d+)$/);
      if (match) seq = parseInt(match[1], 10) + 1;
    }
    const voucherNumber = `${prefix}-${String(seq).padStart(4, '0')}`;

    const journal = await tx.journal.create({
      data: {
        voucherNumber,
        date,
        type,
        narration: narration || null,
        referenceType: referenceType || null,
        referenceId: referenceId != null ? referenceId : null,
        totalDebit,
        totalCredit,
        createdBy: userId,
      },
    });

    await tx.journalLine.createMany({
      data: lines.map((l) => ({
        journalId: journal.id,
        ledgerId: l.ledgerId,
        debit: l.debit || 0,
        credit: l.credit || 0,
        taxType: l.taxType || null,
        taxAmount: l.taxAmount || 0,
      })),
    });

    return tx.journal.findUnique({
      where: { id: journal.id },
      include: { lines: true },
    });
  });
}

// ── 4. Ledger Balance ────────────────────────────────────────────────

async function updateLedgerBalance(ledgerId, yearStart, debitAmount, creditAmount) {
  const balance = await prisma.ledgerBalance.upsert({
    where: {
      ledgerId_yearStart: { ledgerId, yearStart },
    },
    update: {
      debitTotal: { increment: debitAmount },
      creditTotal: { increment: creditAmount },
    },
    create: {
      ledgerId,
      yearStart,
      debitTotal: debitAmount,
      creditTotal: creditAmount,
    },
  });

  const closingBalance =
    balance.openingDebit + balance.debitTotal - balance.openingCredit - balance.creditTotal;

  return prisma.ledgerBalance.update({
    where: { id: balance.id },
    data: { closingBalance },
  });
}

// ── 5. Trial Balance ─────────────────────────────────────────────────

async function getTrialBalance(startDate, endDate) {
  const dateFilter = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const lines = await prisma.journalLine.findMany({
    where: Object.keys(dateFilter).length > 0
      ? { journal: { date: dateFilter } }
      : {},
    include: {
      ledger: { include: { group: true } },
    },
  });

  const map = new Map();

  for (const line of lines) {
    const existing = map.get(line.ledgerId);
    if (existing) {
      existing.debit += line.debit;
      existing.credit += line.credit;
    } else {
      map.set(line.ledgerId, {
        ledgerId: line.ledgerId,
        ledgerName: line.ledger.name,
        groupName: line.ledger.group.name,
        groupReportType: line.ledger.group.reportType,
        groupBsCategory: line.ledger.group.bsCategory || null,
        debit: line.debit,
        credit: line.credit,
      });
    }
  }

  return Array.from(map.values());
}

// ── 6. Profit & Loss ─────────────────────────────────────────────────

async function getProfitAndLoss(startDate, endDate) {
  const fy = await getCurrentFinancialYear();

  const ledgers = await prisma.ledger.findMany({
    where: { group: { reportType: 'profit_loss' } },
    include: { group: true },
  });

  const income = [];
  const expenses = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const ledger of ledgers) {
    const lineWhere = { ledgerId: ledger.id };
    if (startDate || endDate) {
      lineWhere.journal = { date: {} };
      if (startDate) lineWhere.journal.date.gte = startDate;
      if (endDate) lineWhere.journal.date.lte = endDate;
    }

    const lines = await prisma.journalLine.findMany({ where: lineWhere });

    let debit = lines.reduce((s, l) => s + l.debit, 0);
    let credit = lines.reduce((s, l) => s + l.credit, 0);

    const lb = await prisma.ledgerBalance.findUnique({
      where: {
        ledgerId_yearStart: { ledgerId: ledger.id, yearStart: fy.startDate },
      },
    });
    if (lb) {
      debit += lb.openingDebit;
      credit += lb.openingCredit;
    }

    const entry = {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      groupName: ledger.group.name,
      debit,
      credit,
    };

    if (ledger.group.nature === 'credit') {
      entry.net = credit - debit;
      totalIncome += entry.net;
      income.push(entry);
    } else {
      entry.net = debit - credit;
      totalExpense += entry.net;
      expenses.push(entry);
    }
  }

  return {
    income,
    expenses,
    netProfit: totalIncome - totalExpense,
    totalIncome,
    totalExpense,
  };
}

// ── 7. Balance Sheet ─────────────────────────────────────────────────

async function getBalanceSheet(asOfDate) {
  const fy = await getCurrentFinancialYear();

  const ledgers = await prisma.ledger.findMany({
    where: { group: { reportType: 'balance_sheet' } },
    include: { group: true },
  });

  const assets = [];
  const liabilities = [];
  const capital = [];
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const ledger of ledgers) {
    const lineWhere = {
      ledgerId: ledger.id,
      journal: { date: { gte: fy.startDate, ...(asOfDate ? { lte: asOfDate } : {}) } },
    };
    const lines = await prisma.journalLine.findMany({ where: lineWhere });

    let debit = lines.reduce((s, l) => s + l.debit, 0);
    let credit = lines.reduce((s, l) => s + l.credit, 0);

    const lb = await prisma.ledgerBalance.findUnique({
      where: {
        ledgerId_yearStart: { ledgerId: ledger.id, yearStart: fy.startDate },
      },
    });
    if (lb) {
      debit += lb.openingDebit;
      credit += lb.openingCredit;
    }

    const net = ledger.group.nature === 'debit' ? debit - credit : credit - debit;

    const entry = {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      groupName: ledger.group.name,
      debit,
      credit,
      net,
    };

    const cat = ledger.group.bsCategory;
    if (cat === 'asset') {
      assets.push(entry);
      totalAssets += net;
    } else if (cat === 'liability') {
      liabilities.push(entry);
      totalLiabilities += net;
    } else if (cat === 'capital') {
      capital.push(entry);
      totalLiabilities += net;
    }
  }

  return { assets, liabilities, capital, totalAssets, totalLiabilities };
}

// ── 8. Accounts Receivable ───────────────────────────────────────────

async function getAccountsReceivable() {
  const debtorLedgers = await prisma.ledger.findMany({
    where: { purpose: 'receivable' },
    include: { balances: { orderBy: { yearStart: 'desc' }, take: 1 } },
  });
  if (debtorLedgers.length === 0) {
    const fallback = await prisma.accountGroup.findUnique({ where: { code: '1.1.3' } });
    if (!fallback) return [];
    const ledgers = await prisma.ledger.findMany({
      where: { groupId: fallback.id },
      include: { balances: { orderBy: { yearStart: 'desc' }, take: 1 } },
    });
    return ledgers.map((l) => ({
      ledgerId: l.id,
      ledgerName: l.name,
      closingBalance: l.balances[0]?.closingBalance || 0,
    }));
  }
  return debtorLedgers.map((l) => ({
    ledgerId: l.id,
    ledgerName: l.name,
    closingBalance: l.balances[0]?.closingBalance || 0,
  }));
}

// ── 9. Accounts Payable ──────────────────────────────────────────────

async function getAccountsPayable() {
  const creditorLedgers = await prisma.ledger.findMany({
    where: { purpose: 'payable' },
    include: { balances: { orderBy: { yearStart: 'desc' }, take: 1 } },
  });
  if (creditorLedgers.length === 0) {
    const fallback = await prisma.accountGroup.findUnique({ where: { code: '2.1.1' } });
    if (!fallback) return [];
    const ledgers = await prisma.ledger.findMany({
      where: { groupId: fallback.id },
      include: { balances: { orderBy: { yearStart: 'desc' }, take: 1 } },
    });
    return ledgers.map((l) => ({
      ledgerId: l.id,
      ledgerName: l.name,
      closingBalance: l.balances[0]?.closingBalance || 0,
    }));
  }
  return creditorLedgers.map((l) => ({
    ledgerId: l.id,
    ledgerName: l.name,
    closingBalance: l.balances[0]?.closingBalance || 0,
  }));
}

// ── 10. Cash Flow ────────────────────────────────────────────────────

async function getCashFlow(startDate, endDate) {
  const cashLedgers = await prisma.ledger.findMany({
    where: { purpose: { in: ['cash', 'bank', 'upi'] } },
    select: { id: true },
  });
  const cashLedgerIds = new Set(cashLedgers.map((l) => l.id));
  if (cashLedgerIds.size === 0) {
    const fallback = await prisma.accountGroup.findMany({
      where: { code: { in: ['1.1.1', '1.1.2'] } },
    });
    fallback.forEach((g) => {
      cashLedgerIds.add(g.id);
    });
  }

  const dateFilter = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const journals = await prisma.journal.findMany({
    where: {
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      lines: { some: { ledger: { id: { in: [...cashLedgerIds] } } } },
    },
    include: {
      lines: { include: { ledger: { include: { group: true } } } },
    },
  });

  const cashFlow = {
    operating: { inflow: 0, outflow: 0 },
    investing: { inflow: 0, outflow: 0 },
    financing: { inflow: 0, outflow: 0 },
  };

  for (const journal of journals) {
    let cashInflow = 0;
    let cashOutflow = 0;
    const nonCashLines = [];

    for (const line of journal.lines) {
      if (cashLedgerIds.has(line.ledger.id)) {
        cashInflow += line.debit;
        cashOutflow += line.credit;
      } else {
        nonCashLines.push(line);
      }
    }

    if (nonCashLines.length === 0) continue;

    let category = 'operating';
    const cfCat = nonCashLines[0].ledger.group.cfCategory;
    if (cfCat === 'investing') {
      category = 'investing';
    } else if (cfCat === 'financing') {
      category = 'financing';
    }

    cashFlow[category].inflow += cashInflow;
    cashFlow[category].outflow += cashOutflow;
  }

  return cashFlow;
}

// ── 11. Seed Chart of Accounts ───────────────────────────────────────

const COA_GROUPS = [
  { code: '1', name: 'Assets', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: null, parentCode: null },
  { code: '2', name: 'Liabilities', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: null, parentCode: null },
  { code: '3', name: 'Income', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: null, parentCode: null },
  { code: '4', name: 'Expenses', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: null, parentCode: null },
  { code: '5', name: 'Capital', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'capital', cfCategory: null, parentCode: null },

  { code: '1.1', name: 'Current Assets', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: null, parentCode: '1' },
  { code: '1.2', name: 'Fixed Assets', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1' },

  { code: '1.1.1', name: 'Cash in Hand', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.2', name: 'Bank Accounts', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.3', name: 'Sundry Debtors', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.4', name: 'Inventory', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.5', name: 'GST Input CGST', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.6', name: 'GST Input SGST', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.7', name: 'GST Input IGST', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },
  { code: '1.1.8', name: 'Loans and Advances Given', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1.1' },
  { code: '1.1.9', name: 'Prepaid Expenses', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'operating', parentCode: '1.1' },

  { code: '1.2.1', name: 'Furniture and Fixtures', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1.2' },
  { code: '1.2.2', name: 'Computer and Equipment', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1.2' },
  { code: '1.2.3', name: 'Vehicle', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1.2' },
  { code: '1.2.4', name: 'Building', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'asset', cfCategory: 'investing', parentCode: '1.2' },

  { code: '2.1', name: 'Current Liabilities', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: null, parentCode: '2' },
  { code: '2.2', name: 'Long-term Liabilities', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: null, parentCode: '2' },

  { code: '2.1.1', name: 'Sundry Creditors', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.2', name: 'GST Output CGST', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.3', name: 'GST Output SGST', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.4', name: 'GST Output IGST', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.5', name: 'TDS Payable', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.6', name: 'Salary Payable', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },
  { code: '2.1.7', name: 'Outstanding Expenses', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'operating', parentCode: '2.1' },

  { code: '2.2.1', name: 'Loans Taken', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'liability', cfCategory: 'financing', parentCode: '2.2' },

  { code: '3.1', name: 'Sales Account', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '3' },
  { code: '3.2', name: 'Other Income', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '3' },

  { code: '3.2.1', name: 'Discount Received', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '3.2' },
  { code: '3.2.2', name: 'Interest Income', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '3.2' },
  { code: '3.2.3', name: 'Commission Received', nature: 'credit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '3.2' },

  { code: '4.1', name: 'Purchase Account', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4' },
  { code: '4.2', name: 'Direct Expenses', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4' },
  { code: '4.3', name: 'Indirect Expenses', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4' },

  { code: '4.2.1', name: 'Labour Charges', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.2' },
  { code: '4.2.2', name: 'Freight and Transport', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.2' },

  { code: '4.3.1', name: 'Rent', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.2', name: 'Salary and Wages', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.3', name: 'Electricity', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.4', name: 'Telephone and Internet', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.5', name: 'Office Supplies', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.6', name: 'Repairs and Maintenance', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.7', name: 'Discount Allowed', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.8', name: 'Bad Debts', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.9', name: 'Printing and Stationery', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },
  { code: '4.3.10', name: 'Miscellaneous Expense', nature: 'debit', reportType: 'profit_loss', bsCategory: null, cfCategory: 'operating', parentCode: '4.3' },

  { code: '5.1', name: "Owner's Capital", nature: 'credit', reportType: 'balance_sheet', bsCategory: 'capital', cfCategory: 'financing', parentCode: '5' },
  { code: '5.2', name: 'Reserve and Surplus', nature: 'credit', reportType: 'balance_sheet', bsCategory: 'capital', cfCategory: 'financing', parentCode: '5' },
  { code: '5.3', name: 'Drawings', nature: 'debit', reportType: 'balance_sheet', bsCategory: 'capital', cfCategory: 'financing', parentCode: '5' },
];

const COA_LEDGERS = [
  { name: 'Cash in Hand', groupCode: '1.1.1', purpose: 'cash' },
  { name: 'HDFC Bank', groupCode: '1.1.2', purpose: 'bank' },
  { name: 'SBI Bank', groupCode: '1.1.2', purpose: 'bank' },
  { name: 'UPI Collections', groupCode: '1.1.2', purpose: 'upi' },
  { name: 'Sundry Debtors', groupCode: '1.1.3', purpose: 'receivable' },
  { name: 'Inventory', groupCode: '1.1.4', purpose: 'inventory' },
  { name: 'GST Input CGST', groupCode: '1.1.5', purpose: 'gst_input_cgst' },
  { name: 'GST Input SGST', groupCode: '1.1.6', purpose: 'gst_input_sgst' },
  { name: 'GST Input IGST', groupCode: '1.1.7', purpose: 'gst_input_igst' },
  { name: 'Furniture', groupCode: '1.2.1', purpose: null },
  { name: 'Computers', groupCode: '1.2.2', purpose: null },
  { name: 'Sundry Creditors', groupCode: '2.1.1', purpose: 'payable' },
  { name: 'GST Output CGST', groupCode: '2.1.2', purpose: 'gst_output_cgst' },
  { name: 'GST Output SGST', groupCode: '2.1.3', purpose: 'gst_output_sgst' },
  { name: 'GST Output IGST', groupCode: '2.1.4', purpose: 'gst_output_igst' },
  { name: 'Sales', groupCode: '3.1', purpose: 'sales' },
  { name: 'Purchases', groupCode: '4.1', purpose: 'purchases' },
  { name: 'Discount Allowed', groupCode: '4.3.7', purpose: 'discount_allowed' },
  { name: "Owner's Capital", groupCode: '5.1', purpose: 'capital' },
];

function sortGroupCodes(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Look up a ledger by purpose tag. Returns first match.
async function findLedgerByPurpose(purpose) {
  if (!purpose) return null;
  return prisma.ledger.findFirst({ where: { purpose } });
}

// Look up the first ledger in a group by code. Used for payment-method ledgers.
async function findLedgerByGroupCode(code) {
  const group = await prisma.accountGroup.findUnique({ where: { code } });
  if (!group) return null;
  return prisma.ledger.findFirst({ where: { groupId: group.id } });
}

// Look up the first ledger in a group, tagged with a purpose, falling back to group code.
async function findPaymentLedger(paymentMethod) {
  if (paymentMethod === 'CASH') {
    return findLedgerByPurpose('cash');
  } else if (paymentMethod === 'UPI') {
    return findLedgerByPurpose('upi') || findLedgerByPurpose('bank') || findLedgerByPurpose('cash');
  } else if (paymentMethod === 'CARD') {
    return findLedgerByPurpose('bank') || findLedgerByPurpose('cash');
  }
  return findLedgerByPurpose('cash');
}

async function seedChartOfAccounts() {
  const existing = await prisma.accountGroup.count();
  if (existing > 0) return { groups: 0, ledgers: 0, skipped: true };

  return prisma.$transaction(async (tx) => {
    const codeToId = new Map();

    const sorted = [...COA_GROUPS].sort((a, b) => sortGroupCodes(a.code, b.code));

    for (const g of sorted) {
      const parentId = g.parentCode ? codeToId.get(g.parentCode) : null;
      const created = await tx.accountGroup.create({
        data: {
          code: g.code,
          name: g.name,
          nature: g.nature,
          reportType: g.reportType,
          bsCategory: g.bsCategory || null,
          cfCategory: g.cfCategory || null,
          parentId,
          isSystem: true,
        },
      });
      codeToId.set(g.code, created.id);
    }

    let ledgerCount = 0;
    for (const l of COA_LEDGERS) {
      const groupId = codeToId.get(l.groupCode);
      if (!groupId) continue;
      await tx.ledger.create({
        data: { name: l.name, groupId, isSystem: true, purpose: l.purpose || null },
      });
      ledgerCount++;
    }

    return { groups: sorted.length, ledgers: ledgerCount, skipped: false };
  });
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = {
  getCurrentFinancialYear,
  nextVoucherNumber,
  postJournal,
  updateLedgerBalance,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getAccountsReceivable,
  getAccountsPayable,
  getCashFlow,
  seedChartOfAccounts,
  findLedgerByPurpose,
  findLedgerByGroupCode,
  findPaymentLedger,
};
