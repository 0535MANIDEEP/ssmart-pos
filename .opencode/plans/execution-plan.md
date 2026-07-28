# Master Execution Plan — SS Mart POS (Complete)

## Current Status Summary

### ALL BLOCKS COMPLETE ✅ (Verified 2026-07-27)

### What Works
- Express backend with auth, products, customers, invoices, returns, settings, print
- Next.js frontend with POS, dashboard, inventory, customers, sales, settings pages
- SQLite + Prisma 7.8 with 13 migrations applied
- POS checkout with cart, discounts, loyalty, returns, UPI/Card/CASH
- Receipt generation (HTML, PDF, ESC/POS thermal)
- Indian number grouping (₹ symbol, DD/MM/YYYY)
- Dashboard with return-adjusted revenue
- MRP + selling rate display in cart, delete button, QuantityPopover
- Crash recovery (backend + IndexedDB), auto-save every 5s, F-key shortcuts
- Complete double-entry accounting: 53 COA groups, 19 ledgers with DB-driven classification
- Auto-journal on POS sale (balanced Dr/Cr with GST-inclusive tax breakout)
- Manual journal, Trial Balance, P&L, Balance Sheet, Cash Flow, AR/AP, Expenses, Cost Centers
- MARG migration: Excel/CSV upload with auto-column mapping, preview, import
- All 18 frontend pages load HTTP 200, all 12+ backend API endpoints verified
- TypeScript compiles clean (zero errors)

### Known Non-blocking Issues
- ESLint hangs on Node v24 (known `@typescript-eslint/scope-manager` compat issue, not code-related)
- `es-toolkit` peer dependency needed for `recharts` (installed, working)

---

## Execution Order

### BLOCK 1: Fix Bugs + Get Servers Running (Do First)

1. **Fix `backend/src/lib/prisma.js`** — Check if it exports raw DB handle. If not, add `module.exports.rawDb` for backup API.
2. **Fix `backend/src/routes/backup.js`** — Replace `require('../server').getDb()` with `require('../lib/prisma').rawDb`
3. **Fix `backend/src/routes/bills.js`** — Replace `new PrismaClient()` with `require('../lib/prisma')`
4. **Fix `frontend/lib/types.ts`** — Add `showHsnOnPdf`, `backupSchedule`, `backupRetention` to ShopSettings
5. **Start backend** — `node src/server.js` on port 4000, verify health
6. **Start frontend** — `npm run dev` on port 1994, verify loads

### BLOCK 2: POS Features (Crash Recovery + Shortcuts + Sounds)

7. **`frontend/lib/drafts.ts`** — Backend draft persistence API
8. **`frontend/lib/drafts-local.ts`** — IndexedDB fallback
9. **`frontend/hooks/useAutoSave.ts`** — Debounced 2s auto-save
10. **`frontend/hooks/useBillManager.ts`** — Bill state + crash recovery on mount
11. **`frontend/lib/sounds.ts`** — Web Audio API sounds
12. **`frontend/hooks/usePosShortcuts.ts`** — F-key shortcuts
13. **`frontend/components/ui/Dialog.tsx`** — Confirmation/recovery/shutdown dialogs
14. **`frontend/components/ShortcutHelp.tsx`** — F1 help overlay
15. **`frontend/app/(app)/template.tsx`** — Page transitions (motion)
16. **`frontend/app/globals.css`** — New tokens, animations
17. **`frontend/components/Toast.tsx`** — Theme tokens + motion
18. **`frontend/components/AppShell.tsx`** — Sidebar collapse + fullscreen + shutdown
19. **`frontend/app/(app)/pos/page.tsx`** — Integrate all: bill tabs, crash recovery, sounds, shortcuts, confirmation dialogs

### BLOCK 3: Accounting Module Phase A (Core)

20. **`backend/prisma/schema.prisma`** — Add AccountGroup, Ledger, LedgerBalance, FinancialYear, Journal, JournalLine, Expense, MigrationLog, BankReconciliation, CostCenter
21. **Run migration** — `npx prisma migrate dev`
22. **`backend/src/lib/accounting.js`** — Core engine: post journal, update balances, trial balance
23. **`backend/src/routes/accounting.js`** — CRUD for CoA, Ledgers, Journals, Trial Balance
24. **`backend/src/seed/chart-of-accounts.js`** — Default Indian COA seed
25. **`backend/src/hooks/auto-journal.js`** — Auto-journal from invoice/return
26. **Update `backend/src/routes/invoices.js`** — Call auto-journal after checkout
27. **`backend/src/server.js`** — Register accounting routes

28. **`frontend/app/(app)/accounting/page.tsx`** — Accounting dashboard
29. **`frontend/app/(app)/accounting/chart-of-accounts/page.tsx`** — CoA tree
30. **`frontend/app/(app)/accounting/journal/page.tsx`** — Manual journal entry
31. **`frontend/app/(app)/accounting/trial-balance/page.tsx`** — Trial balance

### BLOCK 4: Accounting Module Phase B (Financial Reports)

32. **`backend/src/routes/accounting.js`** — Add P&L, Balance Sheet, Cash Flow endpoints
33. **`frontend/app/(app)/accounting/profit-loss/page.tsx`** — P&L
34. **`frontend/app/(app)/accounting/balance-sheet/page.tsx`** — Balance Sheet
35. **`frontend/app/(app)/accounting/cash-flow/page.tsx`** — Cash Flow

### BLOCK 5: Accounting Module Phase C (AR/AP + Expenses)

36. **`backend/src/routes/accounting.js`** — AR/AP aging, expenses, payment/receipt vouchers
37. **`frontend/app/(app)/accounting/receivables/page.tsx`** — AR aging
38. **`frontend/app/(app)/accounting/payables/page.tsx`** — AP aging
39. **`frontend/app/(app)/accounting/expenses/page.tsx`** — Expense tracking
40. **`frontend/app/(app)/accounting/payments/page.tsx`** — Payment/Receipt vouchers

### BLOCK 6: Accounting Module Phase D (Bank Recon + Cost Centers + MARG Migration)

41. **`backend/src/lib/migrate.js`** — MARG file parser (xlsx/csv)
42. **`backend/src/routes/migrate.js`** — Migration API
43. **`backend/src/server.js`** — Register migrate route
44. **`backend/src/routes/accounting.js`** — Bank recon + cost center endpoints
45. **`frontend/app/(app)/accounting/bank-reconciliation/page.tsx`** — Bank recon
46. **`frontend/app/(app)/accounting/cost-centers/page.tsx`** — Cost centers
47. **`frontend/app/(app)/settings/MigrateFromMarg.tsx`** — Migration wizard

### BLOCK 7: Settings + Navigation

48. **`frontend/app/(app)/settings/page.tsx`** — Add Migration + Backup tabs
49. **`frontend/components/AppShell.tsx`** — Add Accounting nav section
50. **`frontend/lib/types.ts`** — Add all accounting types

### BLOCK 8: Test Everything ✅

51. Start both servers, verify all pages load — **18/18 pages HTTP 200** ✅
52. Test POS: scan → cart → hold → recall → checkout → receipt → accounting entry — **Verified: Invoice INV-2026-00004, stock decremented 92→90, auto-journal SAL-0004 balanced Dr ₹130 = Cr ₹123.81 + ₹3.10 + ₹3.09** ✅
53. Test Accounting: create CoA → add ledgers → journal entry → trial balance → P&L — **Verified: Manual JOU-0001, Trial Balance Dr=Cr=₹1150, P&L net=₹619.04, Balance Sheet assets=₹650** ✅
54. Test MARG Migration: upload file → preview → import → verify ledgers — **Verified: 5/5 products imported, auto-mapped all columns, migration log recorded** ✅
55. `npx tsc --noEmit` — **Passes clean, zero errors** ✅ (ESLint hangs on Node v24, not code-related)

---

## Dependencies to Add

**Backend:** `xlsx` (SheetJS for Excel parsing during MARG migration)
**Frontend:** Already has `motion` and `idb`

---

## Total New Files: ~30
## Total Modified Files: ~10
## Estimated Effort: ~8 blocks of work

---

## Key Design Decisions

1. **Double-entry is mandatory** — Every POS sale auto-creates balanced journal entries
2. **Sub-ledger pattern** — Invoices/Returns are the "sub-ledger", accounting is the "general ledger"
3. **No manual journal needed for routine sales** — Auto-journal handles it
4. **Manual journal for adjustments** — Depreciation, corrections, non-cash entries
5. **Financial year awareness** — Ledger balances are per financial year
6. **MARG auto-mapping** — Fuzzy column matching for MARG export headers
7. **Seed Indian COA** — Pre-built chart of accounts for Indian accounting standards
