const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data', 'pos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Clear existing data ──
['InvoiceItem', 'InvoicePayment', 'Invoice', 'PurchaseItem', 'PurchaseInvoice', 'ReturnItem', 'Return', 'Packing', 'BomItem', 'BillOfMaterial', 'CustomerDuePayment', 'DraftBill', 'LedgerBalance', 'Ledger', 'JournalLine', 'Journal', 'Expense', 'BankReconciliation', 'MigrationLog', 'Product', 'Supplier', 'Customer', 'Salesman', 'ShopSettings', 'User'].forEach(t => {
  try { db.prepare(`DELETE FROM ${t}`).run(); } catch(e) {}
});
try { db.prepare(`DELETE FROM sqlite_sequence`).run(); } catch(e) {}
console.log('Cleared existing data');

const now = new Date().toISOString();

// ── Shop Settings ──
db.prepare(`INSERT INTO ShopSettings (id, shopName, legalName, address1, address2, city, state, phone, email, currencyCode, currencySymbol, gstEnabled, gstNumber, panNumber, defaultTaxRate, loyaltyEnabled, pointsPerUnit, pointValue, receiptHeader, receiptFooter, showGst, autoPrintReceipt, usbPrinterWidth, autoPrintMethod, lowStockAlert, allowNegativeStock, pincode, showHsnOnPdf, backupSchedule, backupRetention) VALUES
(1, 'SS Mart', 'Sai Sangameshwara Mart', '1234 Main Road', 'Near Temple', 'Shankarpally', 'Telangana', '9876543210', 'info@ssmart.in', 'INR', '₹', 1, '36AABCS1234E1Z5', 'AABCS1234E', 18, 1, 10, 10, 'SS Mart - Thank you for shopping!', 'Visit us again!', 1, 0, 80, 'browser', 5, 0, '501203', 1, '0 0 2 * * *', 30)
`).run();

// ── Suppliers ──
const suppliers = [
  ['RS Agro Trading', '36AABCT1234H1Z8', '9876543001', 'rs@agro.in', 'Market Yard', null, 'Hyderabad', 'Telangana', '500001', 'Rajesh Shetty', '15 days', now, now],
  ['Dairy Fresh Distributors', '36AABCD5678I2Z9', '9876543002', 'dairy@fresh.in', 'Industrial Area', null, 'Hyderabad', 'Telangana', '500002', 'Priya Nair', '7 days', now, now],
  ['Beverages World', '36AABCE9012J3Z0', '9876543003', 'orders@beveragesworld.in', 'Shop 12, Connaught Place', null, 'Hyderabad', 'Telangana', '500003', 'Amit Patel', '30 days', now, now],
  ['Global Staples Ltd', '36AABCF3456K4Z1', '9876543004', 'procurement@globalstaples.in', 'GIDC Estate', null, 'Hyderabad', 'Telangana', '500004', 'Suresh Warrier', '15 days', now, now],
  ['Harvest Fresh Fruits', '36AABCJ7890L5Z2', '9876543005', 'sales@harvestfresh.in', 'Fruit Market', null, 'Hyderabad', 'Telangana', '500005', 'Meena Kumari', 'Cash', now, now],
  ['Clean Home Products', '36AABCM1234M6Z3', '9876543006', 'info@cleanhome.in', 'Plot 45, Phase 2', null, 'Hyderabad', 'Telangana', '500006', 'Ravi Gupta', '15 days', now, now],
  ['Spice Route India', '36AABCN5678N7Z4', '9876543007', 'orders@spiceroute.in', 'Spice Market', null, 'Hyderabad', 'Telangana', '500007', 'Anwarullah', 'Cash', now, now],
  ['Patel Dairy Farms', '36AABCO9012O8Z5', '9876543008', 'dairy@patelfarms.in', 'Village Road', null, 'Shankarpally', 'Telangana', '501203', 'Patel Ramesh', '7 days', now, now],
];
const insSup = db.prepare(`INSERT INTO Supplier (name, gstin, phone, email, address1, address2, city, state, pincode, contactPerson, paymentTerms, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
suppliers.forEach(s => { try { insSup.run(s); } catch(e){} });
console.log('Suppliers:', suppliers.length);

// ── Customers ──
const customers = [
  ['Ram Lal', '9876543101', 'ramlal@email.com', 'B', 1500, 15000, 0, 0, 25, now],
  ['Sunita Devi', '9876543102', null, 'A', 8500, 85000, 5000, 0, 60, now],
  ['Ramesh Babu', '9876543103', 'ramesh.b@email.com', 'C', 320, 3200, 0, 0, 8, now],
  ['Lakshmi Bai', '9876543104', null, 'B', 4500, 45000, 2000, 0, 42, now],
  ['Krishna Murthy', '9876543105', 'krishna.m@email.com', 'A', 12000, 120000, 10000, 0, 95, now],
  ['Padmaja Garu', '9876543106', null, 'B', 2800, 28000, 0, 0, 35, now],
  ['Suresh Reddy', '9876543107', 'suresh.r@email.com', 'C', 550, 5500, 0, 0, 14, now],
  ['Anitha K', '9876543108', null, 'B', 1800, 18000, 3000, 0, 20, now],
];
const insCust = db.prepare(`INSERT INTO Customer (name, phone, email, rateTier, loyaltyPoints, totalSpent, totalDue, creditBalance, visits, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)`);
customers.forEach(c => { try { insCust.run(c); } catch(e){} });
console.log('Customers:', customers.length);

// ── Salesmen ──
const salesmen = [
  ['Rajesh Kumar', '9876543201', 'SM001', 1, now],
  ['Priya Sharma', '9876543202', 'SM002', 1, now],
  ['Mohan Das', null, 'SM003', 0, now],
];
const insSm = db.prepare(`INSERT INTO Salesman (name, phone, code, active, createdAt) VALUES (?,?,?,?,?)`);
salesmen.forEach(s => { try { insSm.run(s); } catch(e){} });
console.log('Salesmen:', salesmen.length);

// ── Products ──
const products = [
  ['Basmati Rice 5kg', '8901234000001', 'Rice & Flour', '1006', 'kg', 42000, 45000, 18, null, 0, 25, 5],
  ['Basmati Rice 1kg', '8901234000002', 'Rice & Flour', '1006', 'kg', 8500, 9200, 18, null, 0, 40, 10],
  ['Wheat Flour 1kg', '8901234000003', 'Rice & Flour', '1101', 'kg', 3500, 3800, 18, null, 0, 60, 10],
  ['Atta (Whole Wheat) 1kg', '8901234000007', 'Rice & Flour', '1101', 'kg', 3800, 4200, 18, null, 0, 50, 10],
  ['Sooji 1kg', '8901234000008', 'Rice & Flour', '1101', 'kg', 4000, 4400, 18, null, 0, 15, 5],
  ['Toor Dal 1kg', '8901234000004', 'Pulses & Grains', '0713', 'kg', 12000, 13500, 18, null, 0, 30, 5],
  ['Moong Dal 1kg', '8901234000005', 'Pulses & Grains', '0713', 'kg', 9500, 10500, 18, null, 0, 20, 5],
  ['Chana Dal 1kg', '8901234000006', 'Pulses & Grains', '0713', 'kg', 7000, 7800, 18, null, 0, 35, 10],
  ['Amul Milk 1L', '8901234000009', 'Dairy & Eggs', '0401', 'pc', 700, 750, 18, null, 0, 40, 10],
  ['Amul Milk 500ml', '8901234000010', 'Dairy & Eggs', '0401', 'pc', 380, 400, 18, null, 0, 50, 10],
  ['Amul Butter 500g', '8901234000011', 'Dairy & Eggs', '0405', 'pc', 3500, 3900, 18, null, 0, 15, 5],
  ['Amul Ghee 1L', '8901234000012', 'Oil & Ghee', '0405', 'pc', 7000, 7800, 18, null, 0, 12, 3],
  ['Farm Fresh Eggs (30)', '8901234000013', 'Dairy & Eggs', '0407', 'trays', 2800, 3200, 18, null, 0, 20, 5],
  ['Curd 1L', '8901234000014', 'Dairy & Eggs', '0403', 'pc', 500, 550, 18, null, 0, 30, 10],
  ['Paneer 200g', '8901234000015', 'Dairy & Eggs', '0406', 'pc', 650, 750, 18, null, 0, 10, 3],
  ['Amul Cheese Slices 200g', '8901234000016', 'Dairy & Eggs', '0406', 'pc', 2800, 3200, 18, null, 0, 8, 3],
  ['Coca Cola 1.25L', '8901234000017', 'Beverages', '2202', 'pc', 480, 530, 18, null, 0, 35, 10],
  ['Pepsi 1.25L', '8901234000018', 'Beverages', '2202', 'pc', 480, 530, 18, null, 0, 30, 10],
  ['Thumbs Up 1L', '8901234000019', 'Beverages', '2202', 'pc', 550, 600, 18, null, 0, 20, 5],
  ['Frooti 1L', '8901234000020', 'Beverages', '2202', 'pc', 450, 500, 18, null, 0, 25, 5],
  ['Nescafe Black 200g', '8901234000021', 'Beverages', '0901', 'pc', 4500, 5200, 18, null, 0, 10, 3],
  ['Red Bull 250ml', '8901234000022', 'Beverages', '2202', 'pc', 1200, 1400, 18, null, 0, 15, 5],
  ['Bisleri 1L', '8901234000023', 'Beverages', '2201', 'pc', 1800, 2000, 18, null, 0, 40, 10],
  ['Mineral Water 500ml (24 pack)', '8901234000024', 'Beverages', '2201', 'case', 3600, 4000, 18, null, 0, 12, 3],
  ['Good Day 200ml', '8901234000025', 'Beverages', '2202', 'pc', 500, 550, 18, null, 0, 25, 5],
  ['Tea Leaves (Tata) 250g', '8901234000026', 'Beverages', '0902', 'pc', 3500, 3900, 18, null, 0, 18, 5],
  ['Amul Fresh Milk 500ml', '8901234000027', 'Dairy & Eggs', '0401', 'pc', 380, 400, 18, null, 0, 45, 10],
  ['Lays Classic 40g', '8901234000028', 'Snacks & Namkeen', '1905', 'pc', 200, 220, 18, null, 0, 50, 10],
  ['Uncle Chips 80g', '8901234000029', 'Snacks & Namkeen', '1905', 'pc', 350, 400, 18, null, 0, 30, 5],
  ['Haldiram Aloo Bhujia 400g', '8901234000030', 'Snacks & Namkeen', '1905', 'pc', 1200, 1400, 18, null, 0, 15, 3],
  ['Bikaji Bhujia 400g', '8901234000031', 'Snacks & Namkeen', '1905', 'pc', 1100, 1300, 18, null, 0, 12, 3],
  ['Murukku (Pack 200g)', '8901234000032', 'Snacks & Namkeen', '1905', 'pc', 600, 700, 18, null, 0, 20, 5],
  ['Salted Peanuts 500g', '8901234000033', 'Snacks & Namkeen', '1905', 'pc', 500, 600, 18, null, 0, 18, 5],
  ['Maggi 2-Min Noodles 80g', '8901234000034', 'Snacks & Namkeen', '1905', 'pc', 250, 300, 18, null, 0, 35, 5],
  ['Navratan Mix 500g', '8901234000035', 'Snacks & Namkeen', '1905', 'pc', 900, 1100, 18, null, 0, 10, 3],
  ['Vanilla Ice Cream 1L', '8901234000036', 'Frozen Foods', '0402', 'pc', 1800, 2200, 18, null, 0, 10, 3],
  ['Amul Ice Cream 500ml', '8901234000037', 'Frozen Foods', '0402', 'pc', 1100, 1300, 18, null, 0, 12, 3],
  ['Frozen Peas 1kg', '8901234000038', 'Frozen Foods', '0710', 'kg', 6000, 7000, 18, null, 0, 8, 3],
  ['Frozen Mixed Veg 1kg', '8901234000039', 'Frozen Foods', '0710', 'kg', 5500, 6500, 18, null, 0, 8, 3],
  ['Modern Bread 400g', '8901234000040', 'Bakery & Bread', '1905', 'loaf', 450, 500, 18, null, 0, 15, 5],
  ['Britannia Toast 400g', '8901234000041', 'Bakery & Bread', '1905', 'loaf', 480, 540, 18, null, 0, 12, 3],
  ['Rusk (Britannia) 300g', '8901234000042', 'Bakery & Bread', '1905', 'pc', 350, 400, 18, null, 0, 20, 5],
  ['Pav (Round) 6pcs', '8901234000043', 'Bakery & Bread', '1905', 'pack', 250, 300, 18, null, 0, 20, 5],
  ['Banana Dozen', '8901234000044', 'Fruits & Vegetables', '0803', 'dozen', 800, 1000, 0, null, 0, 20, 5],
  ['Apple (Delicious) 1kg', '8901234000045', 'Fruits & Vegetables', '0808', 'kg', 1800, 2200, 0, null, 0, 10, 3],
  ['Onion 1kg', '8901234000046', 'Fruits & Vegetables', '0703', 'kg', 400, 500, 0, null, 0, 40, 10],
  ['Tomato 1kg', '8901234000047', 'Fruits & Vegetables', '0702', 'kg', 800, 1000, 0, null, 0, 30, 10],
  ['Potato 1kg', '8901234000048', 'Fruits & Vegetables', '0701', 'kg', 300, 400, 0, null, 0, 50, 10],
  ['Carrot 1kg', '8901234000049', 'Fruits & Vegetables', '0706', 'kg', 500, 600, 0, null, 0, 15, 5],
  ['Green Chilli 100g', '8901234000050', 'Fruits & Vegetables', '0709', '100g', 100, 150, 0, null, 0, 30, 10],
  ['Papaya 1pc', '8901234000051', 'Fruits & Vegetables', '0804', 'pc', 250, 350, 0, null, 0, 10, 3],
  ['Cucumber 1kg', '8901234000052', 'Fruits & Vegetables', '0707', 'kg', 400, 500, 0, null, 0, 12, 3],
  ['Coconut 1pc', '8901234000053', 'Fruits & Vegetables', '0801', 'pc', 350, 450, 0, null, 0, 8, 3],
  ['Tide Detergent 500g', '8901234000054', 'Household Items', '3401', 'pc', 900, 1050, 18, null, 0, 15, 3],
  ['Rin Detergent 300g', '8901234000055', 'Household Items', '3401', 'pc', 600, 700, 18, null, 0, 20, 5],
  ['Dishwash Liquid 500ml', '8901234000056', 'Household Items', '3401', 'pc', 650, 750, 18, null, 0, 18, 4],
  ['Toilet Cleaner 500ml', '8901234000057', 'Household Items', '3401', 'pc', 450, 550, 18, null, 0, 20, 5],
  ['Floor Cleaner 1L', '8901234000058', 'Household Items', '3401', 'pc', 800, 950, 18, null, 0, 10, 3],
  ['Himalaya Soap 5 Bar', '8901234000059', 'Personal Care', '3301', 'pack', 2500, 2800, 18, null, 0, 15, 3],
  ['Colgate Toothpaste 200g', '8901234000060', 'Personal Care', '3306', 'pc', 1500, 1800, 18, null, 0, 20, 5],
  ['Shampoo (H&S) 200ml', '8901234000061', 'Personal Care', '3305', 'pc', 2500, 2900, 18, null, 0, 10, 3],
  ['Hair Oil (Parachute) 500ml', '8901234000062', 'Personal Care', '3305', 'pc', 2000, 2400, 18, null, 0, 12, 3],
  ['Lux Bath Soap 4 Bar', '8901234000063', 'Personal Care', '3301', 'pack', 1800, 2100, 18, null, 0, 15, 3],
  ['Kaju Katli 500g', '8901234000064', 'Sweets & Confectionery', '1704', '500g', 1200, 1500, 18, null, 0, 8, 2],
  ['Gulab Jamun (Pack 12)', '8901234000065', 'Sweets & Confectionery', '1704', 'pack', 400, 500, 18, null, 0, 10, 3],
  ['Rasgulla 250g', '8901234000066', 'Sweets & Confectionery', '1704', '250g', 600, 750, 18, null, 0, 8, 2],
  ['Dabur Chyawanprash 1kg', '8901234000067', 'Canned Goods', '2106', 'pc', 4500, 5200, 18, null, 0, 6, 2],
  ['Kissan Jam Mixed Fruit 500g', '8901234000068', 'Canned Goods', '2106', 'pc', 1800, 2100, 18, null, 0, 10, 3],
  ['Sarson Ka Saal 500ml', '8901234000069', 'Canned Goods', '2106', 'pc', 1500, 1800, 18, null, 0, 8, 2],
  ['Turmeric Powder 100g', '8901234000070', 'Spices & Masala', '0904', '100g', 80, 100, 18, null, 0, 60, 10],
  ['Red Chilli Powder 100g', '8901234000071', 'Spices & Masala', '0904', '100g', 120, 150, 18, null, 0, 40, 10],
  ['Coriander Powder 100g', '8901234000072', 'Spices & Masala', '0908', '100g', 90, 110, 18, null, 0, 35, 5],
  ['Cumin Seeds 100g', '8901234000073', 'Spices & Masala', '0908', '100g', 150, 180, 18, null, 0, 25, 5],
  ['Garam Masala 100g', '8901234000074', 'Spices & Masala', '0908', '100g', 200, 250, 18, null, 0, 20, 5],
  ['Haldi (Turmeric) 100g', '8901234000075', 'Spices & Masala', '0904', '100g', 100, 120, 18, null, 0, 30, 5],
  ['Mixed Spice (Curry Powder) 100g', '8901234000076', 'Spices & Masala', '0908', '100g', 180, 220, 18, null, 0, 15, 3],
  ['Parle-G 50g (10pcs)', '8901234000077', 'Snacks & Namkeen', '1905', 'pack', 600, 750, 18, null, 0, 20, 5],
  ['Amul Cream 250ml', '8901234000078', 'Dairy & Eggs', '0401', 'pc', 500, 600, 18, null, 0, 15, 5],
  ['Edible Oil (Soyabean) 1L', '8901234000079', 'Oil & Ghee', '1507', 'pc', 1200, 1400, 18, null, 0, 15, 3],
  ['Mustard Oil 1L', '8901234000080', 'Oil & Ghee', '1514', 'pc', 1400, 1600, 18, null, 0, 12, 3],
];

const insProd = db.prepare(`INSERT INTO Product (name, barcode, category, hsn, unit, purchasePrice, sellingPrice, taxRate, discountType, discountValue, stock, minStock, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
let productCount = 0;
products.forEach(p => {
  const row = [...p, now, now];
  try { insProd.run(row); productCount++; } catch(e) { console.error('Failed:', p[0], e.message.split('\n')[0]); }
});
console.log('Products inserted:', productCount);

// ── Rate tiers (SAAS-style pricing) ──
db.prepare(`UPDATE Product SET rateA = ROUND(sellingPrice * 0.85, 2), rateB = sellingPrice, rateC = sellingPrice WHERE sellingPrice > 0 AND isBulk = 0`).run();
console.log('Rate tiers: A=15% wholesale, B=MRP retail, C=special');

// ── Summary ──
console.log('\n=== Seed Complete ===');
console.log('Products:', db.prepare('SELECT COUNT(*) as c FROM Product').get().c);
console.log('Customers:', db.prepare('SELECT COUNT(*) as c FROM Customer').get().c);
console.log('Suppliers:', db.prepare('SELECT COUNT(*) as c FROM Supplier').get().c);
console.log('Salesmen:', db.prepare('SELECT COUNT(*) as c FROM Salesman').get().c);
console.log('Categories:', [...new Set(products.map(p => p[2]))].length);

db.close();
