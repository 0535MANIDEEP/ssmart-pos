const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { computeSale, round2 } = require('../lib/pricing');
const { journalFromInvoice } = require('../hooks/auto-journal');

const router = express.Router();
router.use(requireAuth);

const checkoutSchema = z
  .object({
    customerName: z.string().trim().max(200).optional().or(z.literal('')),
    customerPhone: z.string().trim().max(30).optional().or(z.literal('')),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          quantity: z.number().int().positive(),
        })
      )
      .default([]),
    discountType: z.enum(['percent', 'amount']).nullish(),
    discountValue: z.number().min(0).default(0),
    pointsRedeemed: z.number().int().min(0).default(0),
    // Split payments: array of { method, amount } — replaces single paymentMethod
    // Falls back to single paymentMethod if payments array not provided (backward compat)
    payments: z
      .array(
        z.object({
          method: z.enum(['CASH', 'UPI', 'CARD']),
          amount: z.number().min(0),
        })
      )
      .optional(),
    // Legacy single payment fields (used when payments array is not provided)
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).default('CASH'),
    amountPaid: z.number().min(0).default(0),
    // Old outstanding due the customer chooses to clear as part of this bill.
    // Added on top of the goods total for what the cashier collects.
    duePaid: z.number().min(0).default(0),
    // Items being returned on this bill, grouped by the original invoice they
    // were sold on. refundAmount is optional per line (defaults to the price
    // originally charged for that quantity) so the cashier can refund less.
    returns: z
      .array(
        z.object({
          invoiceId: z.number().int().positive(),
          items: z
            .array(
              z.object({
                invoiceItemId: z.number().int().positive(),
                quantity: z.number().int().positive(),
                refundAmount: z.number().min(0).optional(),
              })
            )
            .min(1),
        })
      )
      .default([]),
    // How to settle a refund that exceeds the purchase: pay it out in cash or
    // keep it as reusable store credit on the customer.
    refundMode: z.enum(['CASH', 'CREDIT']).default('CASH'),
    // Existing store credit the customer spends on this bill.
    creditApplied: z.number().min(0).default(0),
  })
  .refine((d) => d.items.length > 0 || d.returns.length > 0 || d.duePaid > 0, {
    message: 'Add an item to sell, a return, or a previous due to collect',
  });

async function nextInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  // Find the highest existing invoice number for this year and increment.
  // Inside $transaction, SQLite serializes writes so two concurrent requests
  // cannot read the same last number — no duplicates.
  const last = await tx.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const seq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

// POST /api/invoices — finalize a sale. Everything money-related (prices,
// tax, discount caps, loyalty value) is computed server-side from the
// catalog and settings; the client only sends product ids, quantities, and
// intent (discount/points/payment). Fully transactional.
router.post('/', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const body = parsed.data;

  try {
    const invoiceStub = await prisma.$transaction(async (tx) => {
      const settings = await tx.shopSettings.findFirst();
      if (!settings) throw Object.assign(new Error('Shop settings not configured'), { status: 400 });

      const productIds = body.items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const lines = [];
      for (const item of body.items) {
        const product = productMap.get(item.productId);
        if (!product) throw Object.assign(new Error(`Product ${item.productId} not found`), { status: 404 });
        if (!settings.allowNegativeStock && product.stock < item.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for "${product.name}" (have ${product.stock}, need ${item.quantity})`),
            { status: 409 }
          );
        }
        lines.push({ product, quantity: item.quantity });
      }

      // Resolve customer (needed for loyalty). Match by phone; create if new
      // and a name was given. Cap redeemable points at the customer's balance.
      let customer = null;
      if (body.customerPhone) {
        customer = await tx.customer.findUnique({ where: { phone: body.customerPhone } });
        if (!customer && body.customerName) {
          customer = await tx.customer.create({
            data: { name: body.customerName, phone: body.customerPhone },
          });
        }
      }

      let pointsRedeemed = body.pointsRedeemed;
      if (!settings.loyaltyEnabled || !customer) pointsRedeemed = 0;
      if (customer && pointsRedeemed > customer.loyaltyPoints) pointsRedeemed = customer.loyaltyPoints;

      const computed = computeSale(lines, {
        discountType: body.discountType || null,
        discountValue: body.discountValue,
        pointsRedeemed,
        settings,
      });

      const saleTotal = computed.totalAmount;

      let returnValue = 0;
      const restock = new Map();
      const returnRecords = [];
      for (const grp of body.returns) {
        const original = await tx.invoice.findUnique({ where: { id: grp.invoiceId }, include: { items: true } });
        if (!original) throw Object.assign(new Error(`Invoice ${grp.invoiceId} not found for return`), { status: 404 });
        const itemMap = new Map(original.items.map((it) => [it.id, it]));
        const lines = [];
        let groupRefund = 0;
        for (const rl of grp.items) {
          const invItem = itemMap.get(rl.invoiceItemId);
          if (!invItem) throw Object.assign(new Error('Return item not found on that invoice'), { status: 404 });
          const already = await tx.returnItem.aggregate({
            where: { invoiceItemId: invItem.id },
            _sum: { quantity: true },
          });
          const returnable = invItem.quantity - (already._sum.quantity || 0);
          if (rl.quantity > returnable) {
            throw Object.assign(new Error(`Only ${returnable} of "${invItem.name}" can still be returned`), { status: 409 });
          }
          const maxRefund = round2((invItem.total / invItem.quantity) * rl.quantity);
          const refund = rl.refundAmount != null ? round2(Math.min(Math.max(0, rl.refundAmount), maxRefund)) : maxRefund;
          groupRefund = round2(groupRefund + refund);
          returnValue = round2(returnValue + refund);
          restock.set(invItem.productId, (restock.get(invItem.productId) || 0) + rl.quantity);
          lines.push({
            invoiceItemId: invItem.id,
            productId: invItem.productId,
            name: invItem.name,
            quantity: rl.quantity,
            refundAmount: refund,
          });
        }
        returnRecords.push({ invoiceId: original.id, customerId: original.customerId, groupRefund, lines });
      }

      let creditApplied = 0;
      if (body.creditApplied > 0) {
        if (!customer) throw Object.assign(new Error('A customer is required to use store credit'), { status: 400 });
        creditApplied = round2(Math.min(body.creditApplied, customer.creditBalance, Math.max(0, saleTotal - returnValue)));
      }

      const netBill = round2(saleTotal - returnValue - creditApplied);
      const payable = round2(Math.max(0, netBill));
      const grossRefund = round2(Math.max(0, -netBill));
      let refundMode = null;
      if (grossRefund > 0) {
        refundMode = body.refundMode;
        if (refundMode === 'CREDIT' && !customer) {
          throw Object.assign(new Error('A customer is required to keep a refund as store credit'), { status: 400 });
        }
      }

      let duePaidIntent = 0;
      if (body.duePaid > 0) {
        if (!customer) {
          throw Object.assign(new Error('A customer (with phone number) is required to clear a previous due'), { status: 400 });
        }
        duePaidIntent = round2(Math.min(body.duePaid, customer.totalDue));
      }

      // Split payments: resolve payment lines
      let paymentLines = [];
      if (body.payments && body.payments.length > 0) {
        paymentLines = body.payments
          .filter((p) => p.amount > 0)
          .map((p) => ({ method: p.method, amount: round2(p.amount) }));
      } else {
        // Legacy single payment
        paymentLines = [{ method: body.paymentMethod, amount: round2(body.amountPaid) }];
      }

      const totalTendered = round2(paymentLines.reduce((s, p) => s + p.amount, 0));
      const cashTendered = round2(paymentLines.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0));

      const pool = round2(totalTendered + grossRefund);
      const amountPaid = round2(Math.min(pool, payable));
      const afterGoods = round2(Math.max(0, pool - amountPaid));
      const previousDuePaid = round2(Math.min(duePaidIntent, afterGoods));
      const leftover = round2(Math.max(0, afterGoods - previousDuePaid));
      const changeDue = grossRefund > 0 ? 0 : (grossRefund === 0 && totalTendered > 0 ? round2(Math.max(0, totalTendered - amountPaid - previousDuePaid)) : 0);
      const refundValue = grossRefund > 0 ? leftover : 0;

      // Primary payment method for the invoice record (first non-zero payment, or first in list)
      const primaryMethod = paymentLines.length > 0 ? paymentLines[0].method : body.paymentMethod;

      const dueAmount = round2(Math.max(0, payable - amountPaid));
      if (dueAmount > 0 && !customer) {
        throw Object.assign(
          new Error('A customer (with phone number) is required to record a due/partial-payment amount'),
          { status: 400 }
        );
      }

      const invoiceNumber = await nextInvoiceNumber(tx);
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customer?.id ?? null,
          customerName: body.customerName || customer?.name || 'Walk-in Customer',
          customerPhone: body.customerPhone || null,
          subtotal: computed.subtotal,
          discountType: computed.discountType,
          discountValue: computed.discountValue,
          discountAmount: computed.discountAmount,
          taxAmount: computed.taxAmount,
          loyaltyDiscount: computed.loyaltyDiscount,
          totalAmount: computed.totalAmount,
          paymentMethod: primaryMethod,
          amountPaid,
          changeDue,
          dueAmount,
          previousDuePaid,
          returnValue,
          creditApplied,
          refundValue,
          refundMode,
          pointsRedeemed: computed.pointsRedeemed,
          pointsEarned: computed.pointsEarned,
          items: { create: computed.items },
        },
        include: { items: true },
      });

      // Create individual payment records for split payments
      const savedPayments = [];
      if (paymentLines.length > 0) {
        for (const p of paymentLines) {
          const pay = await tx.invoicePayment.create({
            data: { invoiceId: created.id, method: p.method, amount: p.amount },
          });
          savedPayments.push(pay);
        }
      }

      if (previousDuePaid > 0) {
        await tx.customerDuePayment.create({
          data: { customerId: customer.id, amount: previousDuePaid, note: `Bill ${invoiceNumber}` },
        });
      }

      for (const rr of returnRecords) {
        await tx.return.create({
          data: {
            invoiceId: rr.invoiceId,
            customerId: rr.customerId,
            totalRefund: rr.groupRefund,
            refundMethod: refundValue > 0 ? refundMode : 'BILL_OFFSET',
            note: `Bill ${invoiceNumber}`,
            items: { create: rr.lines },
          },
        });
      }
      for (const [productId, qty] of restock) {
        await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
      }

      for (const item of body.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (customer) {
        const newTotalDue = round2(customer.totalDue + dueAmount - previousDuePaid);
        const creditDelta = (refundMode === 'CREDIT' ? refundValue : 0) - creditApplied;
        const newCredit = round2(customer.creditBalance + creditDelta);
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            loyaltyPoints: { increment: computed.pointsEarned - computed.pointsRedeemed },
            totalSpent: round2(customer.totalSpent + computed.totalAmount),
            totalDue: newTotalDue,
            creditBalance: newCredit,
            visits: { increment: 1 },
          },
        });
      }

      // Return just the id so we can re-fetch with payments outside transaction
      return { id: created.id };
    });

    // Re-fetch invoice with items + payments after transaction commits
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceStub.id },
      include: { items: true, payments: true },
    });

    // Post double-entry journal for this invoice (fire-and-forget, errors logged)
    journalFromInvoice(invoice).catch((err) =>
      console.error('[auto-journal] Post-checkout journal failed:', err.message)
    );

    res.status(201).json(invoice);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Checkout failed' });
  }
});

// GET /api/invoices?q=&from=&to=
router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = q
    ? { OR: [{ invoiceNumber: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] }
    : undefined;
  const invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
  res.json(invoices);
});

// GET /api/invoices/summary — dashboard totals for today. Returns
// (checkout-bundled and standalone) are subtracted to show net revenue.
router.get('/summary', async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [todaysInvoices, todaysReturns, allInvoices, allReturns] = await Promise.all([
    prisma.invoice.findMany({ where: { createdAt: { gte: start } } }),
    prisma.return.findMany({ where: { createdAt: { gte: start } }, select: { totalRefund: true } }),
    prisma.invoice.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.return.aggregate({ _sum: { totalRefund: true } }),
  ]);

  const todaysInvoiceTotal = round2(todaysInvoices.reduce((s, i) => s + i.totalAmount, 0));
  const todaysReturnTotal = round2(todaysReturns.reduce((s, r) => s + r.totalRefund, 0));

  res.json({
    todaysCount: todaysInvoices.length,
    todaysRevenue: round2(todaysInvoiceTotal - todaysReturnTotal),
    totalSales: allInvoices._count,
    totalRevenue: round2((allInvoices._sum.totalAmount || 0) - (allReturns._sum.totalRefund || 0)),
  });
});

// GET /api/invoices/analytics — feeds the dashboard charts: revenue trend
// over the last 14 days, top-selling products (net of returns), and
// payment method mix. All figures subtract returns for accuracy.
router.get('/analytics', async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [recent, topItems, byMethod, recentReturns, returnedItems, returnByMethod] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, totalAmount: true, paymentMethod: true },
    }),
    prisma.invoiceItem.groupBy({
      by: ['productId', 'name'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.invoice.groupBy({
      by: ['paymentMethod'],
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.return.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, totalRefund: true },
    }),
    prisma.returnItem.groupBy({
      by: ['productId', 'name'],
      _sum: { quantity: true, refundAmount: true },
      where: { return: { createdAt: { gte: since } } },
    }),
    prisma.return.groupBy({
      by: ['refundMethod'],
      _sum: { totalRefund: true },
      where: { createdAt: { gte: since } },
    }),
  ]);

  // Revenue trend — subtract returns per day
  const trendMap = new Map();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    trendMap.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), revenue: 0, count: 0 });
  }
  for (const inv of recent) {
    const key = new Date(inv.createdAt).toISOString().slice(0, 10);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.revenue = round2(bucket.revenue + inv.totalAmount);
      bucket.count += 1;
    }
  }
  for (const ret of recentReturns) {
    const key = new Date(ret.createdAt).toISOString().slice(0, 10);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.revenue = round2(bucket.revenue - ret.totalRefund);
    }
  }

  // Top products — net of returns
  const returnMap = new Map(returnedItems.map((r) => [r.productId, r]));
  const topProducts = topItems
    .map((t) => {
      const ret = returnMap.get(t.productId);
      const returnedQty = ret?._sum.quantity || 0;
      const returnedAmt = ret?._sum.refundAmount || 0;
      return {
        name: t.name,
        quantity: (t._sum.quantity || 0) - returnedQty,
        revenue: round2((t._sum.total || 0) - returnedAmt),
      };
    })
    .filter((t) => t.quantity > 0);

  // Payment methods — net of refunds by method
  const returnMethodMap = new Map(returnByMethod.map((r) => [r.refundMethod, r]));
  const paymentMethods = byMethod
    .map((m) => {
      const ret = returnMethodMap.get(m.paymentMethod);
      const returned = ret?._sum.totalRefund || 0;
      return {
        method: m.paymentMethod,
        count: m._count,
        revenue: round2((m._sum.totalAmount || 0) - returned),
      };
    })
    .filter((m) => m.revenue > 0);

  res.json({
    trend: Array.from(trendMap.values()),
    topProducts,
    paymentMethods,
  });
});

// Minimal CSV cell escaping: wrap in quotes and double up any embedded
// quotes if the value contains a comma, quote, or newline.
function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/invoices/export.csv?from=&to= — one row per invoice. Defaults to
// all invoices; from/to (ISO dates) narrow the range for a period report.
router.get('/export.csv', async (req, res) => {
  const where = {};
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(req.query.from);
    if (req.query.to) where.createdAt.lte = new Date(req.query.to);
  }
  const invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' } });

  const header = [
    'Invoice Number',
    'Date',
    'Customer',
    'Phone',
    'Payment Method',
    'Subtotal',
    'Discount',
    'Tax',
    'Loyalty Discount',
    'Total',
    'Amount Paid',
    'Change Due',
  ];
  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    new Date(inv.createdAt).toISOString(),
    inv.customerName,
    inv.customerPhone || '',
    inv.paymentMethod,
    inv.subtotal,
    inv.discountAmount,
    inv.taxAmount,
    inv.loyaltyDiscount,
    inv.totalAmount,
    inv.amountPaid,
    inv.changeDue,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sales-export-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid invoice id' });
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, payments: true } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

module.exports = router;
