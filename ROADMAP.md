# SS Mart POS — Feature Roadmap

## What Already Works ✅
POS billing, barcode scanning, GST (CGST/SGST), inventory, customer dues,
returns, loyalty, receipts (HTML/ESC/POS/PDF), dashboard, staff accounts

## What Needs Building (in priority order)

### Phase 1: Purchase & Supplier Management (Critical)
A grocery shop can't function without tracking what they buy from wholesalers.

**Schema additions:**
- `Supplier` — name, GSTIN, phone, address, outstanding balance
- `PurchaseInvoice` — supplier, invoice#, date, items, total, GST, status
- `PurchaseItem` — product, quantity, unit cost, tax, total

**Backend:**
- `POST/GET/PUT /api/suppliers` — CRUD
- `POST/GET /api/purchases` — purchase entry, auto-stock increment, ITC tracking
- `POST /api/purchases/:id/return` — purchase return (decrements stock)

**Frontend:**
- `/suppliers` page — list, add/edit modal
- `/purchases` page — purchase entry form, list, supplier ledger

### Phase 2: Expense Tracking (Critical)
Every kirana shop tracks rent, salary, electricity, transport, etc.

**Schema:**
- `Expense` — category, description, amount, date, payment method, note

**Backend:** `POST/GET/PUT/DELETE /api/expenses`

**Frontend:** `/expenses` page with category breakdown

### Phase 3: P&L & Accounting (High)
Shop owner needs to know if they're making money.

**Dashboard additions:**
- Gross profit = revenue - COGS (from purchasePrice × qty sold)
- Net profit = gross profit - expenses
- Category-wise profit margins

**Backend:**
- `GET /api/reports/profit-loss?from=&to=` — period P&L
- `GET /api/reports/gst-summary?from=&to=` — GSTR-1 ready data

**Frontend:** `/reports` page with P&L statement, GST summary

### Phase 4: Daily Cash Register (High)
Every shop counts cash at start/end of day.

**Schema:**
- `CashRegister` — openedBy, openTime, openingBalance, closeTime, 
  expectedCash, actualCash, discrepancy, status

**Backend:**
- `POST /api/register/open` — start day with opening balance
- `POST /api/register/close` — count cash, compute discrepancy
- `GET /api/register/current` — today's register status

**Frontend:** Z-report on dashboard, cash count modal

### Phase 5: Pagination & CSV Safety (Medium)
**Backend:** Add `?page=&limit=` to list endpoints, cap CSV export at 5000 rows

### Phase 6: Split Payments (Medium)
Allow ₹500 cash + ₹200 UPI on a single bill.
**Schema:** `InvoicePayment` table (one invoice → many payments)

### Phase 7: Customer Statements (Low)
Print/share monthly statement for credit customers.
**Backend:** `GET /api/customers/:id/statement?from=&to=`
