# MARG ERP Gap Analysis & Execution Plan

## What MARG Has vs What We Have

### BILLING (POS)
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| Item name, MRP, Qty, Rate, Amount columns | ✅ | ✅ | |
| Barcode scanning | ✅ | ✅ | |
| Multiple payment modes | ✅ | ✅ | |
| Bill-level discount | ✅ | ✅ | |
| Return/exchange in same bill | ✅ | ✅ | |
| Customer outstanding tracking | ✅ | ✅ | |
| Loyalty points | ✅ | ✅ | |
| **Item-level discount** | ✅ | ❌ | **MISSING** — discount per item in cart |
| **Hold/Recall bill** | ✅ | ❌ | **MISSING** — park bill, recall later |
| **Salesman tracking** | ✅ | ❌ | **MISSING** — which salesman made the sale |
| **Home delivery management** | ✅ | ❌ | **MISSING** — delivery address, time, status |
| **Last 4 deals display** | ✅ | ❌ | **MISSING** — show last 4 purchase rates at billing |
| **Party-wise rate auto-select** | ✅ | ✅ | Done (rateTier) |
| **Touch screen support** | ✅ | ❌ | **MISSING** — large touch-friendly buttons |
| **Cash drawer integration** | ✅ | ❌ | **MISSING** — open cash drawer on sale |
| **Multiple price lists** | ✅ | ✅ | Done (MRP/Wholesale/Special) |
| **Batch-wise billing** | ✅ | ❌ | **MISSING** — select batch at billing |
| **Expiry indication at billing** | ✅ | ❌ | **MISSING** — show expiry near item |
| **Loss/min/max rate warning** | ✅ | ❌ | **MISSING** — warn if selling below cost |

### INVENTORY
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| Product master (name, barcode, MRP, rate, tax) | ✅ | ✅ | |
| Stock tracking | ✅ | ✅ | |
| Category/group | ✅ | ✅ | |
| **Batch tracking** | ✅ | ❌ | **MISSING** — batch number per product |
| **Expiry date tracking** | ✅ | ❌ | **MISSING** — expiry per batch |
| **Multiple godowns/locations** | ✅ | ❌ | **MISSING** — warehouse/store/counter |
| **Reorder level alerts** | ✅ | ❌ | **MISSING** — auto alert when stock low |
| **Stock valuation method** | ✅ | ❌ | **MISSING** — FIFO / weighted average |
| **Physical stock verification** | ✅ | ❌ | **MISSING** — stock count/audit |
| **Barcode label printing** | ✅ | ✅ | |
| **Stock reports** | ✅ | ❌ | **MISSING** — item-wise, godown-wise |

### PURCHASE
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| Purchase bill entry | ✅ | ✅ | |
| Supplier management | ✅ | ✅ | |
| Per-item discount | ✅ | ✅ | |
| Bill-level discount | ✅ | ✅ | |
| **Purchase order** | ✅ | ❌ | **MISSING** — create PO, track delivery |
| **Supplier outstanding aging** | ✅ | ❌ | **MISSING** — 30/60/90 day aging |
| **Last 4 deals at purchase** | ✅ | ❌ | **MISSING** — show last 4 purchase prices |
| **Purchase return** | ✅ | ❌ | **MISSING** — return to supplier |
| **Auto purchase from reorder** | ✅ | ❌ | **MISSING** — generate PO from low stock |

### ACCOUNTING
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| Double-entry bookkeeping | ✅ | ✅ | |
| Ledger management | ✅ | ✅ | |
| Trial Balance | ✅ | ✅ | |
| P&L Statement | ✅ | ✅ | |
| Balance Sheet | ✅ | ✅ | |
| Journal entries | ✅ | ✅ | |
| Bank reconciliation | ✅ | ✅ | |
| **Payment/Receipt vouchers** | ✅ | ❌ | **MISSING** — manual payment entry |
| **Debtor/Creditor aging** | ✅ | ❌ | **MISSING** — 30/60/90 day reports |
| **GST return filing (GSTR-1, 3B)** | ✅ | ❌ | **MISSING** — generate GST reports |

### REPORTS
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| **Daily sale report** | ✅ | ❌ | **MISSING** — day-wise summary |
| **Item-wise sale report** | ✅ | ❌ | **MISSING** — which items sold how much |
| **Stock report** | ✅ | ❌ | **MISSING** — current stock with values |
| **Outstanding report** | ✅ | ❌ | **MISSING** — who owes what |
| **Profit analysis** | ✅ | ❌ | **MISSING** — item-wise/bill-wise profit |
| **Expiry report** | ✅ | ❌ | **MISSING** — items expiring soon |
| **GST summary report** | ✅ | ❌ | **MISSING** — tax collected/paid |
| **Purchase report** | ✅ | ❌ | **MISSING** — purchase summary |

### SETTINGS / MASTER DATA
| Feature | MARG | SS Mart | Gap |
|---|---|---|---|
| Company profile | ✅ | ✅ | |
| Tax configuration | ✅ | ✅ | |
| **User/Operator management** | ✅ | ❌ | **MISSING** — multiple users with roles |
| **Printer setup** | ✅ | ✅ | |
| **Backup/Restore** | ✅ | ✅ | |
| **Financial year management** | ✅ | ❌ | **MISSING** — open/close FY |

---

## CRITICAL GAPS (Must Fix for Real-World Use)

### Priority 1: BILLING UX (Make it work like MARG)
1. **Item-level discount** — each cart item should have discount % or amount
2. **Hold/Recall bill** — park current sale, recall later
3. **Salesman selection** — track who made the sale
4. **Last deal info** — show last 4 purchase rates when billing
5. **Loss warning** — alert if selling below cost price
6. **Touch-friendly layout** — larger buttons for touch screens

### Priority 2: INVENTORY (Make it track properly)
7. **Batch tracking** — batch number, expiry date per product entry
8. **Expiry management** — track expiry, warn before expiry, return to supplier
9. **Reorder alerts** — auto alert when stock below minimum
10. **Stock valuation** — FIFO / weighted average for cost calculation
11. **Godown/location** — multiple storage locations

### Priority 3: PURCHASE (Make it complete)
12. **Purchase order** — create PO, track delivery status
13. **Purchase return** — return defective/expired items to supplier
14. **Supplier aging** — 30/60/90 day outstanding report

### Priority 4: REPORTS (Make it useful)
15. **Daily sale report** — end-of-day summary
16. **Item-wise sale report** — top selling items
17. **Stock report** — current stock with values
18. **Profit analysis** — item-wise and bill-wise
19. **Outstanding report** — who owes what
20. **GST reports** — GSTR-1, GSTR-3B summary

### Priority 5: ACCOUNTING (Complete the loop)
21. **Payment/Receipt vouchers** — manual payment entry
22. **Debtor/Creditor aging** — 30/60/90 day reports
23. **Financial year management** — open/close FY

---

## Data Structure Changes Needed

### Product Model — Add fields:
```
batchNumber    String?    — batch identifier
expiryDate     DateTime?  — expiry date
reorderLevel   Int        — minimum stock before alert
maxStock       Int?       — maximum stock level
costingMethod  String     — "FIFO" | "WEIGHTED_AVG"
```

### New Model: ProductBatch
```
id             Int        @id
productId      Int
batchNumber    String
expiryDate     DateTime?
quantity       Int        — stock in this batch
purchasePrice  Float      — cost price for this batch
purchaseDate   DateTime
supplierId     Int?
```

### New Model: Godown
```
id             Int        @id
name           String
address        String?
isDefault      Boolean
```

### Product — Add godown:
```
godownId       Int?       — which godown this stock is in
```

### Invoice — Add fields:
```
salesmanId     Int?       — which salesman
holdRecall     Boolean    — is this a held bill?
deliveryAddress String?   — home delivery address
deliveryTime   String?    — preferred delivery time
deliveryStatus String?    — "pending" | "dispatched" | "delivered"
```

### InvoiceItem — Add fields:
```
discountType   String?    — per-item discount
discountValue  Float      — per-item discount amount
batchId        Int?       — which batch was sold
```

### New Model: Salesman
```
id             Int        @id
name           String
phone          String?
commission     Float      — default commission %
isActive       Boolean
```

### New Model: PurchaseOrder
```
id             Int        @id
supplierId     Int
orderDate      DateTime
deliveryDate   DateTime?
status         String     — "pending" | "partial" | "received" | "cancelled"
totalAmount    Float
notes          String?
```

### New Model: PurchaseOrderItem
```
id             Int        @id
poId           Int
productId      Int
quantity       Int
receivedQty    Int        — how much received so far
rate           Float
```

### New Model: PurchaseReturn
```
id             Int        @id
supplierId     Int
returnDate     DateTime
totalAmount    Float
reason         String?
```

### New Model: PurchaseReturnItem
```
id             Int        @id
returnId       Int
productId      Int
batchId        Int?
quantity       Int
rate           Float
```

### New Model: PaymentVoucher
```
id             Int        @id
type           String     — "payment" | "receipt"
partyType      String     — "customer" | "supplier"
partyId        Int
amount         Float
method         String     — "CASH" | "UPI" | "CARD" | "CHEQUE" | "BANK_TRANSFER"
reference      String?    — cheque number, UPI ref
date           DateTime
notes          String?
```

---

## Execution Plan (Ordered by Priority)

### PHASE 1: BILLING UX (Week 1)
1. Add item-level discount to CartItem + InvoiceItem
2. Add hold/recall bill feature (save/load pending bills)
3. Add salesman selection at POS
4. Add last deal display when item is scanned
5. Add loss warning (selling below cost)
6. Make layout touch-friendly

### PHASE 2: INVENTORY (Week 2)
7. Add batch tracking (ProductBatch model)
8. Add expiry date tracking
9. Add reorder level alerts
10. Add godown/location support
11. Add stock valuation (FIFO)

### PHASE 3: PURCHASE (Week 3)
12. Add purchase order feature
13. Add purchase return feature
14. Add supplier aging report
15. Add last 4 deals at purchase time

### PHASE 4: REPORTS (Week 4)
16. Daily sale report
17. Item-wise sale report
18. Stock report with values
19. Profit analysis (item-wise + bill-wise)
20. Outstanding report (debtors/creditors)
21. GST summary report (GSTR-1, 3B)

### PHASE 5: ACCOUNTING (Week 5)
22. Payment/Receipt vouchers
23. Debtor/Creditor aging reports
24. Financial year management
