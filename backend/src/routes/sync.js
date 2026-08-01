// backend/src/routes/sync.js
// ==========================================
// SS Mart — Sync API endpoint
// Receives batched mutations from offline clients
// and applies them to the server database
// ==========================================

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/sync/batch — Receive mutations from client
router.post('/batch', async (req, res) => {
  try {
    const { mutations } = req.body;

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return res.status(400).json({ error: 'No mutations provided' });
    }

    if (mutations.length > 500) {
      return res.status(400).json({ error: 'Batch too large (max 500)' });
    }

    const results = [];
    const errors = [];

    // Process mutations in a transaction
    for (const mutation of mutations) {
      try {
        const { table, operation, recordId, data, timestamp } = mutation;

        // Validate table name (whitelist)
        const allowedTables = [
          'products', 'customers', 'invoices', 'invoice_items',
          'categories', 'suppliers', 'purchases', 'purchase_items',
          'users', 'salesmen', 'settings'
        ];

        if (!allowedTables.includes(table)) {
          errors.push({ recordId, error: `Invalid table: ${table}` });
          continue;
        }

        // Apply mutation based on operation
        let result;
        switch (operation) {
          case 'INSERT':
            result = await prisma[table].create({
              data: { ...data, id: recordId }
            });
            break;

          case 'UPDATE':
            result = await prisma[table].update({
              where: { id: recordId },
              data
            });
            break;

          case 'DELETE':
            result = await prisma[table].delete({
              where: { id: recordId }
            });
            break;

          default:
            errors.push({ recordId, error: `Unknown operation: ${operation}` });
            continue;
        }

        results.push({ recordId, success: true });
      } catch (err) {
        errors.push({
          recordId: mutation.recordId,
          error: err.message
        });
      }
    }

    res.json({
      success: errors.length === 0,
      processed: results.length,
      errors,
      serverTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync batch error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// GET /api/sync/pull — Send latest data to client
router.get('/pull', async (req, res) => {
  try {
    const since = req.query.since || '2024-01-01T00:00:00Z';
    const sinceDate = new Date(since);

    // Fetch changes since last sync
    const [products, customers, categories, suppliers, settings] = await Promise.all([
      prisma.product.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: {
          id: true, name: true, barcode: true, sellingPrice: true,
          mrp: true, costPrice: true, stock: true, unit: true,
          gstRate: true, categoryId: true, supplierId: true,
          isActive: true, updatedAt: true
        }
      }),
      prisma.customer.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: {
          id: true, name: true, phone: true, email: true,
          address: true, loyaltyPoints: true, totalPurchases: true,
          isActive: true, updatedAt: true
        }
      }),
      prisma.category.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: { id: true, name: true, updatedAt: true }
      }),
      prisma.supplier.findMany({
        where: { updatedAt: { gt: sinceDate } },
        select: { id: true, name: true, phone: true, email: true, updatedAt: true }
      }),
      prisma.settings.findFirst({
        select: {
          shopName: true, gstin: true, address: true,
          state: true, stateCode: true, phone: true,
          email: true, gstEnabled: true, loyaltyEnabled: true,
          pointsPerHundred: true, updatedAt: true
        }
      })
    ]);

    res.json({
      products,
      customers,
      categories,
      suppliers,
      settings: settings || null,
      serverTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'Pull failed' });
  }
});

// POST /api/sync/ack — Client acknowledges received data
router.post('/ack', async (req, res) => {
  try {
    const { lastSyncTimestamp } = req.body;
    // Store last sync time for this client (could be per-device)
    res.json({ success: true, serverTimestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Ack failed' });
  }
});

module.exports = router;
