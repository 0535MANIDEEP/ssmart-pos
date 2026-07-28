# Accounting Module — MARG ERP Replacement

## Goal
Build a complete double-entry accounting system that replaces MARG ERP for SS Mart. The system must handle everything from chart of accounts to financial statements, with full MARG ledger migration support.

---

## Architecture: Double-Entry Bookkeeping

Every transaction creates balanced debit/credit entries. The existing Invoice/Customer/Product tables remain as the "sub-ledger" — accounting entries are generated automatically from business operations.

```
Business Layer (existing)          Accounting Layer (new)
─────────────────────────          ──────────────────────
Sale Invoice ──────────────────→  Dr. Cash/Bank/Debtor
                                  Cr. Sales Revenue
                                  Cr. GST Output

Purchase Bill ─────────────────→  Dr. Purchase A/c
                                  Dr. GST Input
                                  Cr. Cash/Bank/Creditor

Payment Received ──────────────→  Dr. Cash/Bank
                                  Cr. Debtor (Customer)

Payment Made ──────────────────→  Dr. Creditor (Supplier)
                                  Cr. Cash/Bank

Expense Entry ─────────────────→  Dr. Expense A/c
                                  Cr. Cash/Bank
```

---

## Chart of Accounts Structure (Indian Accounting Standard)

### Level 1: Account Groups

| Group Code | Group Name | Type | Nature |
|------------|-----------|------|--------|
| 1 | **Assets** | Balance Sheet | Debit |
| 1.1 | Current Assets | Balance Sheet | Debit |
| 1.1.1 | Cash in Hand | Balance Sheet | Debit |
| 1.1.2 | Bank Accounts | Balance Sheet | Debit |
| 1.1.3 | Sundry Debtors | Balance Sheet | Debit |
| 1.1.4 | Inventory | Balance Sheet | Debit |
| 1.1.5 | GST Input (CGST) | Balance Sheet | Debit |
| 1.1.6 | GST Input (SGST) | Balance Sheet | Debit |
| 1.1.7 | GST Input (IGST) | Balance Sheet | Debit |
| 1.1.8 | Loans & Advances Given | Balance Sheet | Debit |
| 1.1.9 | Prepaid Expenses | Balance Sheet | Debit |
| 1.2 | Fixed Assets | Balance Sheet | Debit |
| 1.2.1 | Furniture & Fixtures | Balance Sheet | Debit |
| 1.2.2 | Computer & Equipment | Balance Sheet | Debit |
| 1.2.3 | Vehicle | Balance Sheet | Debit |
| 1.2.4 | Building | Balance Sheet | Debit |
| 2 | **Liabilities** | Balance Sheet | Credit |
| 2.1 | Current Liabilities | Balance Sheet | Credit |
| 2.1.1 | Sundry Creditors | Balance Sheet | Credit |
| 2.1.2 | GST Output (CGST) | Balance Sheet | Credit |
| 2.1.3 | GST Output (SGST) | Balance Sheet | Credit |
| 2.1.4 | GST Output (IGST) | Balance Sheet | Credit |
| 2.1.5 | TDS Payable | Balance Sheet | Credit |
| 2.1.6 | Salary Payable | Balance Sheet | Credit |
| 2.1.7 | Outstanding Expenses | Balance Sheet | Credit |
| 2.2 | Long-term Liabilities | Balance Sheet | Credit |
| 2.2.1 | Loans Taken | Balance Sheet | Credit |
| 3 | **Income** | Profit & Loss | Credit |
| 3.1 | Sales Account | Profit & Loss | Credit |
| 3.2 | Other Income | Profit & Loss | Credit |
| 3.2.1 | Discount Received | Profit & Loss | Credit |
| 3.2.2 | Interest Income | Profit & Loss | Credit |
| 3.2.3 | Commission Received | Profit & Loss | Credit |
| 4 | **Expenses** | Profit & Loss | Debit |
| 4.1 | Purchase Account | Profit & Loss | Debit |
| 4.2 | Direct Expenses | Profit & Loss | Debit |
| 4.2.1 | Labour Charges | Profit & Loss | Debit |
| 4.2.2 | Freight / Transport | Profit & Loss | Debit |
| 4.3 | Indirect Expenses | Profit & Loss | Debit |
| 4.3.1 | Rent | Profit & Loss | Debit |
| 4.3.2 | Salary & Wages | Profit & Loss | Debit |
| 4.3.3 | Electricity | Profit & Loss | Debit |
| 4.3.4 | Telephone & Internet | Profit & Loss | Debit |
| 4.3.5 | Office Supplies | Profit & Loss | Debit |
| 4.3.6 | Repairs & Maintenance | Profit & Loss | Debit |
| 4.3.7 | Discount Allowed | Profit & Loss | Debit |
| 4.3.8 | Bad Debts | Profit & Loss | Debit |
| 4.3.9 | Printing & Stationery | Profit & Loss | Debit |
| 4.3.10 | Miscellaneous Expense | Profit & Loss | Debit |
| 5 | **Capital** | Balance Sheet | Credit |
| 5.1 | Owner's Capital | Balance Sheet | Credit |
| 5.2 | Reserve & Surplus | Balance Sheet | Credit |
| 5.3 | Drawings | Balance Sheet | Debit |

---

## Database Schema (Prisma additions)

### New Models

```prisma
// Chart of Accounts - groups of ledgers
model AccountGroup {
  id          Int      @id @default(autoincrement())
  code        String   @unique // e.g. "1.1.3"
  name        String
  parentId    Int?
  parent      AccountGroup?  @relation("GroupTree", fields: [parentId], references: [id])
  children    AccountGroup[] @relation("GroupTree")
  nature      String         // "debit" | "credit"
  reportType  String         // "balance_sheet" | "profit_loss"
  isSystem    Boolean  @default(false) // built-in groups can't be deleted
  createdAt   DateTime @default(now())
  ledgers     Ledger[]
}

// Individual ledger accounts
model Ledger {
  id          Int         @id @default(autoincrement())
  name        String
  groupId     Int
  group       AccountGroup @relation(fields: [groupId], references: [id])
  openingDebit  Float     @default(0)
  openingCredit Float     @default(0)
  isSystem    Boolean     @default(false)
  // Link to customer/supplier if applicable
  linkedEntityType String? // "customer" | "supplier" | null
  linkedEntityId   Int?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  journalLines JournalLine[]
  balances     LedgerBalance[]
  @@unique([groupId, name])
}

// Running balance cache per ledger per financial year
model LedgerBalance {
  id          Int      @id @default(autoincrement())
  ledgerId    Int
  ledger      Ledger   @relation(fields: [ledgerId], references: [id])
  yearStart   DateTime // financial year start (e.g. 2026-04-01)
  debitTotal  Float    @default(0)
  creditTotal Float    @default(0)
  closingBalance Float @default(0) // computed: opening + debit - credit
  @@unique([ledgerId, yearStart])
}

// Financial year definition
model FinancialYear {
  id        Int      @id @default(autoincrement())
  name      String   @unique // "2026-27"
  startDate DateTime @unique
  endDate   DateTime @unique
  isClosed  Boolean  @default(false)
  createdAt DateTime @default(now())
}

// Journal voucher (the core accounting entry)
model Journal {
  id            Int      @id @default(autoincrement())
  voucherNumber String   @unique
  date          DateTime
  type          String   // "sales" | "purchase" | "payment" | "receipt" | "journal" | "contra" | "credit_note" | "debit_note"
  referenceType String?  // "invoice" | "return" | "payment" | null
  referenceId   Int?     // ID of the linked invoice/return/payment
  narration     String?
  totalDebit    Float    @default(0)
  totalCredit   Float    @default(0)
  isApproved    Boolean  @default(true)
  createdBy     Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lines         JournalLine[]
  @@index([date])
  @@index([type])
}

// Individual lines of a journal entry (always balanced: sum(debit) == sum(credit))
model JournalLine {
  id        Int     @id @default(autoincrement())
  journalId Int
  journal   Journal @relation(fields: [journalId], references: [id], onDelete: Cascade)
  ledgerId  Int
  ledger    Ledger  @relation(fields: [ledgerId], references: [id])
  debit     Float   @default(0)
  credit    Float   @default(0)
  // For GST tracking
  taxType   String? // "CGST" | "SGST" | "IGST" | null
  taxAmount Float   @default(0)
}

// Expense tracking (separate from purchase bills)
model Expense {
  id          Int      @id @default(autoincrement())
  date        DateTime
  ledgerId    Int      // the expense ledger (e.g. Rent, Salary)
  ledger      Ledger   @relation(fields: [ledgerId], references: [id])
  amount      Float
  paymentMode String   // "cash" | "bank" | "upi"
  bankLedgerId Int?    // if paid via bank
  reference   String?  // cheque number, UPI ref, etc.
  narration   String?
  partyName   String?  // who was paid (for records)
  createdBy   Int
  createdAt   DateTime @default(now())
}

// Bank reconciliation
model BankReconciliation {
  id            Int      @id @default(autoincrement())
  journalId     Int      // the payment/receipt journal entry
  journal       Journal  @relation(fields: [journalId], references: [id])
  statementDate DateTime // date on bank statement
  statementRef  String?  // cheque number, UPI ref on statement
  reconciled    Boolean  @default(false)
  reconciledAt  DateTime?
  createdAt     DateTime @default(now())
}

// Cost center for department/project tracking
model CostCenter {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  code      String?  @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  journalLines JournalLine[] // via separate mapping table if needed
}

// MARG migration log
model MigrationLog {
  id         Int      @id @default(autoincrement())
  source     String   // "marg" | "tally" | "manual"
  dataType   String   // "ledgers" | "products" | "customers" | "opening_balances"
  filename   String?
  recordsImported Int  @default(0)
  recordsSkipped  Int  @default(0)
  errors     String?  // JSON array of error messages
  status     String   // "success" | "partial" | "failed"
  createdBy  Int
  createdAt  DateTime @default(now())
}
```

---

## Voucher Types & Auto-Entry Rules

### 1. Sales Voucher (Auto-generated from Invoice checkout)

When a sale is finalized on the POS:

```
If payment = CASH:
  Dr. Cash in Hand          ₹totalAmount
  Cr. Sales Account         ₹subtotal
  Cr. GST Output (CGST)     ₹cgst
  Cr. GST Output (SGST)     ₹sgst

If payment = CREDIT (customer has due):
  Dr. Sundry Debtors (Customer Ledger)  ₹totalAmount
  Cr. Sales Account         ₹subtotal
  Cr. GST Output            ₹tax

If payment = UPI/CARD:
  Dr. Bank Account (UPI/Card) ₹totalAmount
  Cr. Sales Account           ₹subtotal
  Cr. GST Output              ₹tax

If discount given:
  Dr. Discount Allowed       ₹discountAmount
  Cr. Sales Account          ₹discountAmount (reduces revenue)

If loyalty redeemed:
  Dr. Loyalty Liability      ₹loyaltyValue
  Cr. Sales Account          ₹loyaltyValue (or reduce revenue)
```

### 2. Purchase Voucher (Manual or from stock import)

```
Dr. Purchase Account        ₹purchaseTotal
Dr. GST Input (CGST)        ₹cgst
Dr. GST Input (SGST)        ₹sgst
Cr. Sundry Creditors (Supplier) ₹totalAmount
```

### 3. Payment Voucher (Money going OUT)

```
Dr. Creditor / Expense Ledger  ₹amount
Cr. Cash / Bank                ₹amount
```

### 4. Receipt Voucher (Money coming IN)

```
Dr. Cash / Bank                ₹amount
Cr. Debtor / Income Ledger     ₹amount
```

### 5. Journal Voucher (Adjustments, non-cash)

```
Dr. Ledger A    ₹amount
Cr. Ledger B    ₹amount
(No cash/bank involved)
```

### 6. Contra Voucher (Cash ↔ Bank transfer)

```
Dr. Bank Account    ₹amount
Cr. Cash in Hand    ₹amount
```

### 7. Credit Note (Sales Return)

```
Dr. Sales Account / Discount Allowed   ₹amount
Dr. GST Output (reversal)              ₹tax
Cr. Sundry Debtors (Customer)          ₹totalAmount
```

### 8. Debit Note (Purchase Return)

```
Dr. Sundry Creditors (Supplier)        ₹totalAmount
Cr. Purchase Account                   ₹amount
Cr. GST Input (reversal)               ₹tax
```

---

## Financial Reports

### Trial Balance
- List all ledgers with their closing balances
- Debit column | Credit column
- Total must match (Dr = Cr)
- Grouped by Account Groups

### Profit & Loss Statement
```
INCOME
  Sales Revenue                   xxx
  Less: Sales Returns             (xxx)
  Less: Discount Allowed          (xxx)
  Add: Other Income               xxx
  ─────────────────────────────
  Total Income                    xxx

EXPENSES
  Purchases                       xxx
  Less: Purchase Returns          (xxx)
  Direct Expenses                 xxx
  Indirect Expenses               xxx
  ─────────────────────────────
  Total Expenses                  xxx
  ═══════════════════════════
  NET PROFIT / (LOSS)             xxx
```

### Balance Sheet
```
ASSETS
  Current Assets
    Cash in Hand                  xxx
    Bank Balance                  xxx
    Sundry Debtors                xxx
    Inventory                     xxx
    GST Input Credit              xxx
  Fixed Assets
    Furniture & Fixtures          xxx
    Computer & Equipment          xxx
  ─────────────────────────────
  TOTAL ASSETS                    xxx

LIABILITIES
  Current Liabilities
    Sundry Creditors              xxx
    GST Output Liability          xxx
    Outstanding Expenses          xxx
  Capital
    Owner's Capital               xxx
    Add: Net Profit               xxx
    Less: Drawings               (xxx)
  ─────────────────────────────
  TOTAL LIABILITIES + CAPITAL     xxx
```

### Cash Flow Statement
```
OPERATING ACTIVITIES
  Cash received from customers    xxx
  Cash paid to suppliers         (xxx)
  Cash paid for expenses         (xxx)
  Net cash from operations        xxx

INVESTING ACTIVITIES
  Purchase of fixed assets       (xxx)
  Net cash from investing        (xxx)

FINANCING ACTIVITIES
  Owner's capital introduced      xxx
  Loans taken                     xxx
  Drawings                       (xxx)
  Net cash from financing        (xxx)
  ═══════════════════════════
  Net increase in cash            xxx
  Opening cash balance            xxx
  ─────────────────────────────
  Closing cash balance            xxx
```

### Accounts Receivable (Debtors) Aging
| Customer | Current | 1-30 days | 31-60 days | 61-90 days | 90+ days | Total |
|----------|---------|-----------|------------|------------|----------|-------|

### Accounts Payable (Creditors) Aging
| Supplier | Current | 1-30 days | 31-60 days | 61-90 days | 90+ days | Total |
|----------|---------|-----------|------------|------------|----------|-------|

---

## MARG ERP Migration Feature

### What MARG Exports

**1. Ledger Export** (Books > All Ledgers > Alt+P > Excel)
Columns: `Name`, `Address`, `Phone`, `State`, `Opening Balance`, `Account Group`, `Outstanding`

**2. Item/Product Export** (Masters > Data Import/Export > Product Export)
Columns: `Item Name`, `Batch No`, `Expiry`, `Qty`, `MRP`, `Purchase Rate`, `HSN`, `GST%`, `Company`, `Group`, `Barcode`, `Sale Rate`, `Unit`

**3. Sales Register Export** (Daily Reports > Multi Bill Printing > F6)
Columns: `Bill No`, `Date`, `Party Name`, `Amount`, `Tax`, `Total`

**4. Purchase Register**
Similar to sales but for purchases.

### Migration Flow

```
┌─────────────────────────────────────────────────────────┐
│  Migrate from MARG ERP                                  │
│                                                         │
│  Step 1: What to import?                                │
│  [📊 Chart of Accounts] [👤 Customers/Debtors]          │
│  [📦 Products/Inventory] [💰 Opening Balances]          │
│  [📋 Sales History] [🛒 Purchase History]               │
│                                                         │
│  Step 2: Upload MARG export file (.xlsx/.csv)           │
│  ┌─────────────────────────────────────────────┐        │
│  │  Drag & drop file here                      │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  Step 3: Column Mapping (auto-detected from MARG)       │
│  MARG Column        →  Our Field          Status        │
│  Party Name         →  Ledger Name         ✓            │
│  Account Group      →  Account Group       ✓            │
│  Opening Balance    →  Opening Balance     ✓            │
│  Phone              →  Phone (Customer)    ✓            │
│                                                         │
│  Step 4: Preview & Validate                             │
│  [Show first 50 rows with errors highlighted]           │
│                                                         │
│  Step 5: Import                                         │
│  Created: 247 ledgers, 89 customers, 1200 products     │
│  Skipped: 12 (duplicates), Errors: 0                    │
│                                                         │
│  [Import] [Cancel]                                      │
└─────────────────────────────────────────────────────────┘
```

### Auto-Mapping Rules (MARG → Our System)

| MARG Account Group | Our Account Group |
|---|---|
| Sundry Debtors | Sundry Debtors (1.1.3) |
| Sundry Creditors | Sundry Creditors (2.1.1) |
| Bank Accounts | Bank Accounts (1.1.2) |
| Cash-in-Hand | Cash in Hand (1.1.1) |
| Sales Account | Sales Account (3.1) |
| Purchase Account | Purchase Account (4.1) |
| Indirect Income | Other Income (3.2) |
| Indirect Expenses | Indirect Expenses (4.3) |
| Direct Expenses | Direct Expenses (4.2) |
| Fixed Assets | Fixed Assets (1.2) |
| Capital Account | Owner's Capital (5.1) |
| Current Liabilities | Current Liabilities (2.1) |
| Current Assets | Current Assets (1.1) |
| Loans (Liability) | Loans Taken (2.2.1) |
| Loans & Advances (Asset) | Loans & Advances Given (1.1.8) |

---

## Implementation Phases

### Phase A: Core Accounting (Week 1-2)
**Goal:** Chart of Accounts + Ledgers + Manual Journal Entries + Trial Balance

**Backend:**
1. `backend/prisma/schema.prisma` — Add AccountGroup, Ledger, LedgerBalance, FinancialYear, Journal, JournalLine, Expense, MigrationLog models
2. `backend/src/routes/accounting.js` — CRUD for AccountGroups, Ledgers, Journals, Trial Balance
3. `backend/src/lib/accounting.js` — Core accounting engine: post journal, update ledger balances, compute trial balance
4. `backend/src/seed/chart-of-accounts.js` — Default Indian COA seed script

**Frontend:**
5. `frontend/app/(app)/accounting/page.tsx` — Accounting dashboard (links to all accounting features)
6. `frontend/app/(app)/accounting/chart-of-accounts/page.tsx` — CoA tree view, add/edit groups & ledgers
7. `frontend/app/(app)/accounting/journal/page.tsx` — Journal voucher entry (manual double-entry)
8. `frontend/app/(app)/accounting/trial-balance/page.tsx` — Trial balance report with date range

### Phase B: Financial Reports (Week 3-4)
**Goal:** P&L, Balance Sheet, Auto-journal from POS

**Backend:**
9. `backend/src/routes/accounting.js` — Add P&L, Balance Sheet, Cash Flow endpoints
10. `backend/src/hooks/auto-journal.js` — Auto-generate journal entries on invoice checkout, returns, payments
11. Update `backend/src/routes/invoices.js` — Call auto-journal after creating invoice

**Frontend:**
12. `frontend/app/(app)/accounting/profit-loss/page.tsx` — P&L report
13. `frontend/app/(app)/accounting/balance-sheet/page.tsx` — Balance sheet
14. `frontend/app/(app)/accounting/cash-flow/page.tsx` — Cash flow statement

### Phase C: Receivables/Payables + Expenses (Week 5-6)
**Goal:** AR/AP aging, expense tracking, payment/receipt vouchers

**Backend:**
15. `backend/src/routes/accounting.js` — Add AR/AP aging, expense CRUD, payment/receipt vouchers
16. Auto-link customer due payments to debtor ledger

**Frontend:**
17. `frontend/app/(app)/accounting/receivables/page.tsx` — AR aging report
18. `frontend/app/(app)/accounting/payables/page.tsx` — AP aging report
19. `frontend/app/(app)/accounting/expenses/page.tsx` — Expense entry & tracking
20. `frontend/app/(app)/accounting/payments/page.tsx` — Payment/Receipt voucher entry

### Phase D: Bank Reconciliation + Cost Centers + Migration (Week 7-8)
**Goal:** Bank recon, cost centers, MARG migration wizard

**Backend:**
21. `backend/src/routes/accounting.js` — Bank reconciliation, cost center assignment
22. `backend/src/routes/migrate.js` — MARG export parser (xlsx/csv), column auto-mapper, bulk import

**Frontend:**
23. `frontend/app/(app)/accounting/bank-reconciliation/page.tsx` — Match book vs bank statement
24. `frontend/app/(app)/accounting/cost-centers/page.tsx` — Manage cost centers
25. `frontend/app/(app)/settings/MigrateFromMarg.tsx` — Multi-step migration wizard

### Phase E: Polish + MARG Migration UX (Week 8)
26. Update sidebar navigation with Accounting section
27. MARG migration wizard with preview, validation, rollback
28. Financial year closing (carry forward balances)
29. Print/export all reports

---

## Files to Create/Modify

### New Backend Files
| File | Description |
|------|-------------|
| `backend/src/routes/accounting.js` | All accounting CRUD + reports |
| `backend/src/lib/accounting.js` | Core engine: post journal, update balances |
| `backend/src/hooks/auto-journal.js` | Auto-journal from POS transactions |
| `backend/src/routes/migrate.js` | MARG migration API |
| `backend/src/lib/migrate.js` | MARG file parser (xlsx/csv) |
| `backend/src/seed/chart-of-accounts.js` | Default Indian COA seed |

### New Frontend Files
| File | Description |
|------|-------------|
| `frontend/app/(app)/accounting/page.tsx` | Accounting dashboard |
| `frontend/app/(app)/accounting/chart-of-accounts/page.tsx` | CoA tree view |
| `frontend/app/(app)/accounting/journal/page.tsx` | Journal entry |
| `frontend/app/(app)/accounting/trial-balance/page.tsx` | Trial balance |
| `frontend/app/(app)/accounting/profit-loss/page.tsx` | P&L statement |
| `frontend/app/(app)/accounting/balance-sheet/page.tsx` | Balance sheet |
| `frontend/app/(app)/accounting/cash-flow/page.tsx` | Cash flow |
| `frontend/app/(app)/accounting/receivables/page.tsx` | AR aging |
| `frontend/app/(app)/accounting/payables/page.tsx` | AP aging |
| `frontend/app/(app)/accounting/expenses/page.tsx` | Expense tracking |
| `frontend/app/(app)/accounting/payments/page.tsx` | Payment/Receipt vouchers |
| `frontend/app/(app)/accounting/bank-reconciliation/page.tsx` | Bank recon |
| `frontend/app/(app)/accounting/cost-centers/page.tsx` | Cost centers |
| `frontend/app/(app)/settings/MigrateFromMarg.tsx` | Migration wizard |

### Modified Files
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add all accounting models |
| `backend/src/server.js` | Register accounting + migrate routes |
| `backend/src/routes/invoices.js` | Call auto-journal on checkout |
| `backend/src/routes/settings.js` | Add financial year settings |
| `frontend/components/AppShell.tsx` | Add Accounting nav section |
| `frontend/lib/types.ts` | Add accounting types |
| `frontend/app/(app)/settings/page.tsx` | Add Migration tab |
