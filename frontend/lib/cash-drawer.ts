// frontend/lib/cash-drawer.ts
// ==========================================
// SS Mart — Daily Cash Drawer Management
// Open/close cash reconciliation
// ==========================================

const STORAGE_KEY = 'ssmart-cash-drawer';

export interface CashDrawerEntry {
  id: string;
  date: string; // DD/MM/YYYY
  openedAt: string; // ISO timestamp
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  variance?: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalCredit: number;
  totalReturns: number;
  billCount: number;
  expenses: number;
  isOpen: boolean;
}

export interface DailyCashSummary {
  date: string;
  openingBalance: number;
  currentCash: number;
  totalSales: number;
  totalReturns: number;
  totalExpenses: number;
  expectedCash: number;
  billCount: number;
  cashIn: number;
  cashOut: number;
}

// Get all entries from localStorage
function getEntries(): CashDrawerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save entries to localStorage
function saveEntries(entries: CashDrawerEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Get today's date in DD/MM/YYYY format
function getToday(): string {
  return new Date().toLocaleDateString('en-IN');
}

// Get or create today's drawer
export function getTodayDrawer(): CashDrawerEntry | null {
  const entries = getEntries();
  const today = getToday();
  return entries.find((e) => e.date === today && e.isOpen) || null;
}

// Check if today's drawer is open
export function isDrawerOpen(): boolean {
  return getTodayDrawer() !== null;
}

// Open today's cash drawer
export function openDrawer(openingBalance: number): CashDrawerEntry {
  const entries = getEntries();
  const today = getToday();

  // Check if already open
  const existing = entries.find((e) => e.date === today && e.isOpen);
  if (existing) {
    throw new Error('Drawer already open for today');
  }

  const entry: CashDrawerEntry = {
    id: `drawer-${Date.now()}`,
    date: today,
    openedAt: new Date().toISOString(),
    openingBalance,
    closingBalance: undefined,
    expectedBalance: undefined,
    variance: undefined,
    totalSales: 0,
    totalCash: 0,
    totalCard: 0,
    totalUpi: 0,
    totalCredit: 0,
    totalReturns: 0,
    billCount: 0,
    expenses: 0,
    isOpen: true,
  };

  entries.push(entry);
  saveEntries(entries);

  return entry;
}

// Record a sale in today's drawer
export function recordSale(payment: {
  cash: number;
  card: number;
  upi: number;
  credit: number;
  total: number;
}): void {
  const entries = getEntries();
  const today = getToday();
  const idx = entries.findIndex((e) => e.date === today && e.isOpen);

  if (idx === -1) return;

  entries[idx].totalSales += payment.total;
  entries[idx].totalCash += payment.cash;
  entries[idx].totalCard += payment.card;
  entries[idx].totalUpi += payment.upi;
  entries[idx].totalCredit += payment.credit;
  entries[idx].billCount += 1;

  saveEntries(entries);
}

// Record a return in today's drawer
export function recordReturn(amount: number): void {
  const entries = getEntries();
  const today = getToday();
  const idx = entries.findIndex((e) => e.date === today && e.isOpen);

  if (idx === -1) return;

  entries[idx].totalReturns += amount;
  saveEntries(entries);
}

// Record an expense
export function recordExpense(amount: number): void {
  const entries = getEntries();
  const today = getToday();
  const idx = entries.findIndex((e) => e.date === today && e.isOpen);

  if (idx === -1) return;

  entries[idx].expenses += amount;
  saveEntries(entries);
}

// Close today's cash drawer
export function closeDrawer(closingBalance: number): CashDrawerEntry {
  const entries = getEntries();
  const today = getToday();
  const idx = entries.findIndex((e) => e.date === today && e.isOpen);

  if (idx === -1) {
    throw new Error('No open drawer found for today');
  }

  const entry = entries[idx];
  const expected =
    entry.openingBalance +
    entry.totalCash -
    entry.totalReturns -
    entry.expenses;

  entry.closingBalance = closingBalance;
  entry.expectedBalance = expected;
  entry.variance = closingBalance - expected;
  entry.closedAt = new Date().toISOString();
  entry.isOpen = false;

  entries[idx] = entry;
  saveEntries(entries);

  return entry;
}

// Get daily summary
export function getDailySummary(): DailyCashSummary {
  const drawer = getTodayDrawer();

  if (!drawer) {
    return {
      date: getToday(),
      openingBalance: 0,
      currentCash: 0,
      totalSales: 0,
      totalReturns: 0,
      totalExpenses: 0,
      expectedCash: 0,
      billCount: 0,
      cashIn: 0,
      cashOut: 0,
    };
  }

  const expectedCash =
    drawer.openingBalance +
    drawer.totalCash -
    drawer.totalReturns -
    drawer.expenses;

  return {
    date: drawer.date,
    openingBalance: drawer.openingBalance,
    currentCash: expectedCash,
    totalSales: drawer.totalSales,
    totalReturns: drawer.totalReturns,
    totalExpenses: drawer.expenses,
    expectedCash,
    billCount: drawer.billCount,
    cashIn: drawer.totalCash,
    cashOut: drawer.totalReturns + drawer.expenses,
  };
}

// Get historical entries (last N days)
export function getHistory(days: number = 30): CashDrawerEntry[] {
  const entries = getEntries();
  return entries
    .filter((e) => !e.isOpen)
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
    .slice(0, days);
}

// Export as CSV
export function exportCashDrawerCSV(): string {
  const entries = getEntries().filter((e) => !e.isOpen);

  const header = 'Date,Opening,Closing,Expected,Variance,Sales,Cash,Card,UPI,Credit,Returns,Expenses,Bills';
  const rows = entries.map((e) =>
    [
      e.date,
      e.openingBalance,
      e.closingBalance || 0,
      e.expectedBalance || 0,
      e.variance || 0,
      e.totalSales,
      e.totalCash,
      e.totalCard,
      e.totalUpi,
      e.totalCredit,
      e.totalReturns,
      e.expenses,
      e.billCount,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
