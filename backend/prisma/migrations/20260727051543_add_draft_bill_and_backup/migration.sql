-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopName" TEXT NOT NULL,
    "legalName" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT 'Rs.',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "defaultTaxRate" REAL NOT NULL DEFAULT 0,
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pointsPerUnit" REAL NOT NULL DEFAULT 0,
    "pointValue" REAL NOT NULL DEFAULT 0,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT NOT NULL DEFAULT 'Thank You! Visit Again.',
    "showGst" BOOLEAN NOT NULL DEFAULT true,
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT false,
    "usbPrinterWidth" INTEGER NOT NULL DEFAULT 80,
    "autoPrintMethod" TEXT NOT NULL DEFAULT 'browser',
    "lowStockAlert" INTEGER NOT NULL DEFAULT 5,
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "pincode" TEXT,
    "backupSchedule" TEXT NOT NULL DEFAULT '0 2 * * *',
    "backupRetention" INTEGER NOT NULL DEFAULT 30,
    "showHsnOnPdf" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_ShopSettings" ("address1", "address2", "allowNegativeStock", "autoPrintMethod", "autoPrintReceipt", "city", "currencyCode", "currencySymbol", "defaultTaxRate", "email", "gstEnabled", "gstNumber", "id", "legalName", "lowStockAlert", "loyaltyEnabled", "panNumber", "phone", "pincode", "pointValue", "pointsPerUnit", "receiptFooter", "receiptHeader", "shopName", "showGst", "state", "usbPrinterWidth") SELECT "address1", "address2", "allowNegativeStock", "autoPrintMethod", "autoPrintReceipt", "city", "currencyCode", "currencySymbol", "defaultTaxRate", "email", "gstEnabled", "gstNumber", "id", "legalName", "lowStockAlert", "loyaltyEnabled", "panNumber", "phone", "pincode", "pointValue", "pointsPerUnit", "receiptFooter", "receiptHeader", "shopName", "showGst", "state", "usbPrinterWidth" FROM "ShopSettings";
DROP TABLE "ShopSettings";
ALTER TABLE "new_ShopSettings" RENAME TO "ShopSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
