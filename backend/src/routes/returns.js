const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { round2 } = require('../lib/pricing');

const router = express.Router();
router.use(requireAuth);

const returnSchema = z.object({
  invoiceId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        invoiceItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  refundMethod: z.enum(['CASH', 'UPI', 'CARD', 'DUE_ADJUST']).default('CASH'),
  note: z.string().trim().max(200).optional().or(z.literal('')),
});

// POST /api/returns — return one or more lines from a past invoice. Restocks
// the returned quantity, refunds either as cash/UPI/card or by reducing the
// customer's outstanding due. Also updates the customer's totalSpent and
// clawing back loyalty points earned on the returned items.
router.post('/', async (req, res) => {
  const parsed = returnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const body = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: body.invoiceId }, include: { items: true } });
      if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

      const settings = await tx.shopSettings.findFirst();
      const itemMap = new Map(invoice.items.map((it) => [it.id, it]));

      // Batch-fetch already-returned quantities for all invoice items (avoids N+1)
      const alreadyReturnedMap = new Map();
      {
        const agg = await tx.returnItem.groupBy({
          by: ['invoiceItemId'],
          where: { invoiceItemId: { in: invoice.items.map(it => it.id) } },
          _sum: { quantity: true },
        });
        for (const a of agg) alreadyReturnedMap.set(a.invoiceItemId, a._sum.quantity || 0);
      }

      const returnLines = [];
      for (const line of body.items) {
        const invoiceItem = itemMap.get(line.invoiceItemId);
        if (!invoiceItem || invoiceItem.invoiceId !== invoice.id) {
          throw Object.assign(new Error('Invoice item not found on this invoice'), { status: 404 });
        }
        const returnable = invoiceItem.quantity - (alreadyReturnedMap.get(invoiceItem.id) || 0);
        if (line.quantity > returnable) {
          throw Object.assign(
            new Error(`Only ${returnable} of "${invoiceItem.name}" can still be returned`),
            { status: 409 }
          );
        }
        const refundAmount = round2((invoiceItem.total / invoiceItem.quantity) * line.quantity);
        returnLines.push({ invoiceItem, quantity: line.quantity, refundAmount });
      }

      const totalRefund = round2(returnLines.reduce((sum, l) => sum + l.refundAmount, 0));

      if (body.refundMethod === 'DUE_ADJUST') {
        if (!invoice.customerId) {
          throw Object.assign(new Error('This invoice has no customer to adjust a due for'), { status: 400 });
        }
      }

      const created = await tx.return.create({
        data: {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          totalRefund,
          refundMethod: body.refundMethod,
          note: body.note || null,
          items: {
            create: returnLines.map((l) => ({
              invoiceItemId: l.invoiceItem.id,
              productId: l.invoiceItem.productId,
              name: l.invoiceItem.name,
              quantity: l.quantity,
              refundAmount: l.refundAmount,
            })),
          },
        },
        include: { items: true },
      });

      // Restock returned products
      for (const l of returnLines) {
        await tx.product.update({
          where: { id: l.invoiceItem.productId },
          data: { stock: { increment: l.quantity } },
        });
      }

      // Update customer balances: totalSpent, loyalty points, and due adjustment
      if (invoice.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: invoice.customerId } });

        // Claw back loyalty points: recalculate points earned on returned items
        // Points formula mirrors pricing.js: pointsPerUnit per rupee of selling price
        let pointsToClawBack = 0;
        if (settings?.loyaltyEnabled && settings?.pointsPerUnit > 0) {
          pointsToClawBack = returnLines.reduce((sum, l) => {
            const unitPrice = l.invoiceItem.total / l.invoiceItem.quantity;
            return sum + Math.floor(unitPrice * settings.pointsPerUnit) * l.quantity;
          }, 0);
        }

        const customerUpdate = {
          totalSpent: round2(Math.max(0, customer.totalSpent - totalRefund)),
          loyaltyPoints: Math.max(0, customer.loyaltyPoints - pointsToClawBack),
        };

        // Due adjustment
        if (body.refundMethod === 'DUE_ADJUST') {
          const adjust = Math.min(totalRefund, customer.totalDue);
          if (adjust > 0) {
            customerUpdate.totalDue = round2(customer.totalDue - adjust);
          }
        }

        await tx.customer.update({ where: { id: invoice.customerId }, data: customerUpdate });
      }

      return created;
    });

    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Return failed' });
  }
});

// GET /api/returns/by-invoice/:invoiceId — returns already made against an
// invoice, so the frontend can compute remaining returnable quantity per
// line without re-deriving it from raw ReturnItem rows itself.
router.get('/by-invoice/:invoiceId', async (req, res) => {
  const invoiceId = Number(req.params.invoiceId);
  if (!Number.isInteger(invoiceId)) return res.status(400).json({ error: 'Invalid invoice id' });
  const returns = await prisma.return.findMany({
    where: { invoiceId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(returns);
});

module.exports = router;
