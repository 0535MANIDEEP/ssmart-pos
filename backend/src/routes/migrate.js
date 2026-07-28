const express = require('express');
const xlsx = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const prisma = require('../lib/prisma');

const router = express.Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const COLUMN_MAP = {
  'item name': 'name', 'product name': 'name', 'name': 'name',
  'barcode': 'barcode', 'item code': 'barcode', 'code': 'barcode',
  'mrp': 'sellingPrice', 'm.r.p.': 'sellingPrice',
  'purchase rate': 'purchasePrice', 'purchase price': 'purchasePrice', 'cost': 'purchasePrice', 'cost price': 'purchasePrice',
  'sale rate': 'sellingPrice', 'selling price': 'sellingPrice', 'rate': 'sellingPrice',
  'gst': 'taxRate', 'gst%': 'taxRate', 'tax': 'taxRate', 'tax rate': 'taxRate', 'gst rate': 'taxRate',
  'hsn': 'hsn', 'hsn code': 'hsn',
  'qty': 'stock', 'quantity': 'stock', 'stock': 'stock', 'current stock': 'stock',
  'unit': 'unit', 'uqc': 'unit',
  'batch no': 'batch', 'batch': 'batch',
  'expiry': 'expiry',
  'company': 'category', 'manufacturer': 'category', 'brand': 'category',
  'group': 'category', 'category': 'category',
  'phone': 'phone', 'mobile': 'phone', 'contact': 'phone', 'phone no': 'phone', 'mobile no': 'phone',
  'address': 'address',
  'state': 'state',
  'opening balance': 'openingBalance', 'balance': 'openingBalance', 'ob': 'openingBalance',
  'account group': 'accountGroup', 'ledger group': 'accountGroup', 'group name': 'accountGroup',
  'email': 'email',
  'pincode': 'pincode', 'pin': 'pincode',
};

function autoMapColumns(headers) {
  const mapping = {};
  headers.forEach(h => {
    const normalized = h.toLowerCase().trim();
    if (COLUMN_MAP[normalized]) {
      mapping[h] = COLUMN_MAP[normalized];
    }
  });
  return mapping;
}

const MARG_GROUP_MAP = {
  'sundry debtors': '1.1.3',
  'debtors': '1.1.3',
  'accounts receivable': '1.1.3',
  'sundry creditors': '2.1.1',
  'creditors': '2.1.1',
  'accounts payable': '2.1.1',
  'bank accounts': '1.1.2',
  'bank': '1.1.2',
  'cash-in-hand': '1.1.1',
  'cash in hand': '1.1.1',
  'cash': '1.1.1',
  'sales account': '3.1',
  'sales': '3.1',
  'purchase account': '4.1',
  'purchase': '4.1',
  'indirect income': '3.2',
  'other income': '3.2',
  'indirect expenses': '4.3',
  'direct expenses': '4.2',
  'fixed assets': '1.2',
  'capital account': '5.1',
  'capital': '5.1',
  'current liabilities': '2.1',
  'current assets': '1.1',
  'loans (liability)': '2.2.1',
  'loans taken': '2.2.1',
  'loans & advances (asset)': '1.1.8',
  'loans and advances': '1.1.8',
};

router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (data.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'File is empty' });
    }

    const headers = Object.keys(data[0]);
    const detectedMapping = autoMapColumns(headers);
    const preview = data.slice(0, 50);

    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({ headers, detectedMapping, preview, totalRows: data.length });
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { type, mapping, rows } = req.body;

    if (!type || !mapping || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Missing type, mapping, or rows' });
    }

    let imported = 0, skipped = 0;
    const errors = [];

    if (type === 'products') {
      for (const row of rows) {
        try {
          const mapped = {};
          for (const [margCol, ourField] of Object.entries(mapping)) {
            if (row[margCol] !== undefined && row[margCol] !== '') {
              mapped[ourField] = row[margCol];
            }
          }
          if (!mapped.name) { skipped++; continue; }

          if (!mapped.barcode) {
            mapped.barcode = `MARG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          }

          const barcode = String(mapped.barcode).trim();

          await prisma.product.upsert({
            where: { barcode },
            create: {
              barcode,
              name: String(mapped.name).trim(),
              category: mapped.category ? String(mapped.category).trim() : null,
              hsn: mapped.hsn ? String(mapped.hsn).trim() : null,
              unit: mapped.unit ? String(mapped.unit).trim() : null,
              purchasePrice: Number(mapped.purchasePrice) || 0,
              sellingPrice: Number(mapped.sellingPrice) || Number(mapped.purchasePrice) || 0,
              taxRate: Number(mapped.taxRate) || 0,
              stock: Number(mapped.stock) || 0,
            },
            update: {
              name: String(mapped.name).trim(),
              category: mapped.category ? String(mapped.category).trim() : undefined,
              hsn: mapped.hsn ? String(mapped.hsn).trim() : undefined,
              purchasePrice: Number(mapped.purchasePrice) || undefined,
              sellingPrice: Number(mapped.sellingPrice) || undefined,
              taxRate: Number(mapped.taxRate) || undefined,
              stock: Number(mapped.stock) || undefined,
            },
          });
          imported++;
        } catch (err) {
          errors.push({ row, error: err.message });
          skipped++;
        }
      }
    } else if (type === 'customers') {
      for (const row of rows) {
        try {
          const mapped = {};
          for (const [margCol, ourField] of Object.entries(mapping)) {
            if (row[margCol] !== undefined && row[margCol] !== '') mapped[ourField] = row[margCol];
          }
          if (!mapped.name) { skipped++; continue; }

          const phone = mapped.phone
            ? String(mapped.phone).replace(/[^0-9]/g, '')
            : `CUST-${Date.now()}-${imported}`;

          await prisma.customer.upsert({
            where: { phone },
            create: {
              name: String(mapped.name).trim(),
              phone,
              email: mapped.email ? String(mapped.email).trim() : null,
            },
            update: {
              name: String(mapped.name).trim(),
              email: mapped.email ? String(mapped.email).trim() : undefined,
            },
          });
          imported++;
        } catch (err) {
          errors.push({ row, error: err.message });
          skipped++;
        }
      }
    } else if (type === 'ledgers') {
      const groupCount = await prisma.accountGroup.count();
      if (groupCount === 0) {
        return res.status(400).json({ error: 'Chart of Accounts not seeded. Run /api/accounting/seed first.' });
      }

      for (const row of rows) {
        try {
          const mapped = {};
          for (const [margCol, ourField] of Object.entries(mapping)) {
            if (row[margCol] !== undefined && row[margCol] !== '') mapped[ourField] = row[margCol];
          }
          if (!mapped.name) { skipped++; continue; }

          let groupId;
          const groupKey = mapped.accountGroup ? mapped.accountGroup.toLowerCase().trim() : '';
          const groupCode = MARG_GROUP_MAP[groupKey];
          if (groupCode) {
            const group = await prisma.accountGroup.findUnique({ where: { code: groupCode } });
            if (group) groupId = group.id;
          }
          if (!groupId) {
            const defaultGroup = await prisma.accountGroup.findUnique({ where: { code: '1.1.3' } });
            groupId = defaultGroup?.id;
          }
          if (!groupId) { skipped++; continue; }

          const ob = Number(mapped.openingBalance) || 0;

          const linkedType = groupCode === '1.1.3' ? 'customer' : groupCode === '2.1.1' ? 'supplier' : null;

          await prisma.ledger.create({
            data: {
              name: String(mapped.name).trim(),
              groupId,
              openingDebit: ob > 0 ? ob : 0,
              openingCredit: ob < 0 ? Math.abs(ob) : 0,
              linkedEntityType: linkedType,
            },
          });
          imported++;
        } catch (err) {
          if (err.code === 'P2002') { skipped++; }
          else { errors.push({ row, error: err.message }); skipped++; }
        }
      }
    } else {
      return res.status(400).json({ error: `Unknown import type: "${type}". Use "products", "customers", or "ledgers".` });
    }

    await prisma.migrationLog.create({
      data: {
        source: 'marg',
        dataType: type,
        recordsImported: imported,
        recordsSkipped: skipped,
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 20)) : null,
        status: errors.length === 0 ? 'success' : 'partial',
        createdBy: req.user?.id || 1,
      },
    });

    res.json({ imported, skipped, errors: errors.slice(0, 20), total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/log', async (req, res) => {
  try {
    const logs = await prisma.migrationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
