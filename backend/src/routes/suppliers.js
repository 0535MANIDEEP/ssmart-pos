"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// ═══════════════════════════════════════════════════════════════
// SUPPLIERS CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/suppliers — list all
router.get("/", async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { purchaseInvoices: true } },
      },
    });
    res.json(suppliers);
  } catch (err) {
    console.error("GET /api/suppliers error:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// GET /api/suppliers/:id — single supplier with ledger
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseInvoices: {
          orderBy: { date: "desc" },
          take: 50,
          include: { items: true },
        },
      },
    });
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    res.json(supplier);
  } catch (err) {
    console.error("GET /api/suppliers/:id error:", err);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
});

// POST /api/suppliers — create
router.post("/", async (req, res) => {
  try {
    const { name, gstin, phone, email, address1, address2, city, state, pincode, contactPerson, paymentTerms } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Supplier name is required" });

    const existing = await prisma.supplier.findUnique({ where: { name: name.trim() } });
    if (existing) return res.status(409).json({ error: "Supplier with this name already exists" });

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        gstin: gstin?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address1: address1?.trim() || null,
        address2: address2?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pincode: pincode?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        paymentTerms: paymentTerms?.trim() || null,
      },
    });
    res.status(201).json(supplier);
  } catch (err) {
    console.error("POST /api/suppliers error:", err);
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

// PUT /api/suppliers/:id — update
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, gstin, phone, email, address1, address2, city, state, pincode, contactPerson, paymentTerms, isActive } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(gstin !== undefined && { gstin: gstin?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address1 !== undefined && { address1: address1?.trim() || null }),
        ...(address2 !== undefined && { address2: address2?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(state !== undefined && { state: state?.trim() || null }),
        ...(pincode !== undefined && { pincode: pincode?.trim() || null }),
        ...(contactPerson !== undefined && { contactPerson: contactPerson?.trim() || null }),
        ...(paymentTerms !== undefined && { paymentTerms: paymentTerms?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(supplier);
  } catch (err) {
    console.error("PUT /api/suppliers/:id error:", err);
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// DELETE /api/suppliers/:id — soft delete (set inactive)
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const hasPurchases = await prisma.purchaseInvoice.findFirst({ where: { supplierId: id } });
    if (hasPurchases) {
      // Soft delete — just mark inactive
      await prisma.supplier.update({ where: { id }, data: { isActive: false } });
      return res.json({ message: "Supplier deactivated (has purchase history)" });
    }
    await prisma.supplier.delete({ where: { id } });
    res.json({ message: "Supplier deleted" });
  } catch (err) {
    console.error("DELETE /api/suppliers/:id error:", err);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

// ═══════════════════════════════════════════════════════════════
// PURCHASE INVOICES
// ═══════════════════════════════════════════════════════════════

// GET /api/suppliers/purchases — list all purchase invoices
router.get("/purchases/all", async (req, res) => {
  try {
    const { supplierId, status, from, to } = req.query;
    const where = {};
    if (supplierId) where.supplierId = Number(supplierId);
    if (status) where.status = status;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + "T23:59:59");
    }

    const purchases = await prisma.purchaseInvoice.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
      },
    });
    res.json(purchases);
  } catch (err) {
    console.error("GET /api/suppliers/purchases error:", err);
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

// POST /api/suppliers/purchases — create purchase invoice (auto-stocks products)
router.post("/purchases", async (req, res) => {
  try {
    const { supplierId, invoiceNumber, date, dueDate, items, discountAmount, paymentMethod, notes } = req.body;

    if (!supplierId) return res.status(400).json({ error: "Supplier is required" });
    if (!invoiceNumber?.trim()) return res.status(400).json({ error: "Invoice number is required" });
    if (!items || items.length === 0) return res.status(400).json({ error: "At least one item is required" });

    // Check duplicate
    const existing = await prisma.purchaseInvoice.findFirst({
      where: { supplierId: Number(supplierId), invoiceNumber: invoiceNumber.trim() },
    });
    if (existing) return res.status(409).json({ error: "This invoice number already exists for this supplier" });

    let subtotal = 0;
    let totalTax = 0;

    // Build items with calculated totals
    const lineItems = items.map((item) => {
      const unitCost = Number(item.unitCost) || 0;
      const quantity = Number(item.quantity) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const lineSubtotal = unitCost * quantity;
      const lineTax = Math.round(lineSubtotal * taxRate / 100 * 100) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      totalTax += lineTax;

      return {
        productId: Number(item.productId),
        name: item.name || "",
        quantity,
        unitCost,
        taxRate,
        taxAmount: lineTax,
        total: lineTotal,
        batchNumber: item.batchNumber || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      };
    });

    const totalAmount = subtotal - (Number(discountAmount) || 0) + totalTax;

    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase invoice
      const inv = await tx.purchaseInvoice.create({
        data: {
          supplierId: Number(supplierId),
          invoiceNumber: invoiceNumber.trim(),
          date: date ? new Date(date) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          subtotal,
          discountAmount: Number(discountAmount) || 0,
          taxAmount: totalTax,
          totalAmount,
          amountPaid: 0,
          status: "pending",
          paymentMethod: paymentMethod || null,
          notes: notes || null,
          createdBy: req.user?.id || 0,
          items: { create: lineItems },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
        },
      });

      // Auto-increment stock for each product
      for (const item of lineItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Update supplier outstanding balance
      await tx.supplier.update({
        where: { id: Number(supplierId) },
        data: { outstandingBalance: { increment: totalAmount } },
      });

      return inv;
    });

    res.status(201).json(purchase);
  } catch (err) {
    console.error("POST /api/suppliers/purchases error:", err);
    res.status(500).json({ error: "Failed to create purchase invoice" });
  }
});

// POST /api/suppliers/purchases/:id/pay — record payment against purchase
router.post("/purchases/:id/pay", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { amount, paymentMethod } = req.body;

    const purchase = await prisma.purchaseInvoice.findUnique({ where: { id } });
    if (!purchase) return res.status(404).json({ error: "Purchase invoice not found" });

    const payAmount = Number(amount) || 0;
    if (payAmount <= 0) return res.status(400).json({ error: "Payment amount must be positive" });

    const newPaid = purchase.amountPaid + payAmount;
    const newStatus = newPaid >= purchase.totalAmount ? "paid" : "partial";

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          amountPaid: newPaid,
          status: newStatus,
          ...(paymentMethod && { paymentMethod }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: true,
        },
      });

      // Reduce supplier outstanding balance
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { outstandingBalance: { decrement: payAmount } },
      });

      return inv;
    });

    res.json(updated);
  } catch (err) {
    console.error("POST /api/suppliers/purchases/:id/pay error:", err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// POST /api/suppliers/purchases/:id/return — purchase return (decrements stock)
router.post("/purchases/:id/return", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { items } = req.body; // [{ purchaseItemId, quantity }]

    const purchase = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!purchase) return status(404).json({ error: "Purchase invoice not found" });

    if (!items || items.length === 0) return res.status(400).json({ error: "No return items specified" });

    const updated = await prisma.$transaction(async (tx) => {
      let returnAmount = 0;

      for (const ri of items) {
        const purchaseItem = purchase.items.find((pi) => pi.id === Number(ri.purchaseItemId));
        if (!purchaseItem) continue;

        const returnQty = Math.min(Number(ri.quantity), purchaseItem.quantity);
        if (returnQty <= 0) continue;

        const refundLine = (purchaseItem.unitCost * returnQty);
        returnAmount += refundLine;

        // Decrement stock
        await tx.product.update({
          where: { id: purchaseItem.productId },
          data: { stock: { decrement: returnQty } },
        });
      }

      // Update purchase status
      const newStatus = returnAmount >= purchase.totalAmount ? "returned" : "partial";
      await tx.purchaseInvoice.update({
        where: { id },
        data: { status: newStatus },
      });

      // Reduce supplier outstanding
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: { outstandingBalance: { decrement: returnAmount } },
      });

      return { returnAmount, status: newStatus };
    });

    res.json({ message: "Purchase return processed", ...updated });
  } catch (err) {
    console.error("POST /api/suppliers/purchases/:id/return error:", err);
    res.status(500).json({ error: "Failed to process purchase return" });
  }
});

// ═══════════════════════════════════════════════════════════════
// BILL OF MATERIALS (BOM)
// ═══════════════════════════════════════════════════════════════

// GET /api/suppliers/bom — list all BOMs
router.get("/bom/all", async (req, res) => {
  try {
    const boms = await prisma.billOfMaterial.findMany({
      orderBy: { name: "asc" },
      include: {
        outputProduct: { select: { id: true, name: true, barcode: true, unit: true } },
        items: { include: { product: { select: { id: true, name: true, barcode: true, unit: true } } } },
      },
    });
    res.json(boms);
  } catch (err) {
    console.error("GET /api/suppliers/bom error:", err);
    res.status(500).json({ error: "Failed to fetch BOMs" });
  }
});

// POST /api/suppliers/bom — create BOM
router.post("/bom", async (req, res) => {
  try {
    const { name, description, outputProductId, outputQuantity, items } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "BOM name is required" });
    if (!outputProductId) return res.status(400).json({ error: "Output product is required" });
    if (!items || items.length === 0) return res.status(400).json({ error: "At least one ingredient is required" });

    const bom = await prisma.billOfMaterial.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        outputProductId: Number(outputProductId),
        outputQuantity: Number(outputQuantity) || 1,
        items: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            unit: item.unit || null,
          })),
        },
      },
      include: {
        outputProduct: { select: { id: true, name: true, barcode: true } },
        items: { include: { product: { select: { id: true, name: true, barcode: true } } } },
      },
    });
    res.status(201).json(bom);
  } catch (err) {
    console.error("POST /api/suppliers/bom error:", err);
    res.status(500).json({ error: "Failed to create BOM" });
  }
});

// POST /api/suppliers/bom/:id/produce — execute BOM (consume ingredients, produce output)
router.post("/bom/:id/produce", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { quantity } = req.body; // how many batches to produce
    const batches = Number(quantity) || 1;

    const bom = await prisma.billOfMaterial.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!bom) return res.status(404).json({ error: "BOM not found" });

    const produced = await prisma.$transaction(async (tx) => {
      // Check ingredient availability
      for (const item of bom.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const required = item.quantity * batches;
        if (product.stock < required) {
          throw new Error(`Insufficient stock for "${product.name}": need ${required}, have ${product.stock}`);
        }
      }

      // Consume ingredients
      for (const item of bom.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity * batches } },
        });
      }

      // Produce output
      const outputQty = bom.outputQuantity * batches;
      await tx.product.update({
        where: { id: bom.outputProductId },
        data: { stock: { increment: outputQty } },
      });

      return { produced: outputQty, batches };
    });

    res.json({ message: `Produced ${produced.produced} packs in ${produced.batches} batch(es)`, ...produced });
  } catch (err) {
    console.error("POST /api/suppliers/bom/:id/produce error:", err);
    res.status(500).json({ error: err.message || "Failed to produce BOM" });
  }
});

// DELETE /api/suppliers/bom/:id
router.delete("/bom/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.billOfMaterial.delete({ where: { id } });
    res.json({ message: "BOM deleted" });
  } catch (err) {
    console.error("DELETE /api/suppliers/bom/:id error:", err);
    res.status(500).json({ error: "Failed to delete BOM" });
  }
});

module.exports = router;
