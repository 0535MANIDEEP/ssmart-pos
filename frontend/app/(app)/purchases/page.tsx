"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search, Receipt, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import type { Supplier, PurchaseInvoice, PurchaseItem, Product } from "@/lib/types";

interface PurchaseLine {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  batchNumber: string;
}

export default function PurchasesPage() {
  const { show } = useToast();
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CREDIT");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [p, s, pr] = await Promise.all([
        api.get<PurchaseInvoice[]>("/suppliers/purchases/all"),
        api.get<Supplier[]>("/suppliers"),
        api.get<Product[]>("/products"),
      ]);
      setPurchases(p);
      setSuppliers(s);
      setProducts(pr);
    } catch {
      show("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { productId: 0, name: "", quantity: 1, unitCost: 0, taxRate: 0, batchNumber: "" }]);
  }

  function updateLine(idx: number, field: keyof PurchaseLine, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === "productId") {
          const p = products.find((p) => p.id === Number(value));
          if (p) {
            updated.name = p.name;
            updated.taxRate = p.taxRate;
            updated.unitCost = p.purchasePrice;
          }
        }
        return updated;
      })
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const totalTax = lines.reduce((s, l) => s + (l.unitCost * l.quantity * l.taxRate) / 100, 0);
  const total = subtotal - discountAmount + totalTax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier) return show("Select a supplier", "error");
    if (!invoiceNum.trim()) return show("Invoice number is required", "error");
    if (lines.length === 0) return show("Add at least one item", "error");
    if (lines.some((l) => !l.productId || l.quantity <= 0)) return show("Fill all item details", "error");

    setSaving(true);
    try {
      await api.post("/suppliers/purchases", {
        supplierId: selectedSupplier,
        invoiceNumber: invoiceNum,
        date: purchaseDate,
        dueDate: dueDate || null,
        items: lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          quantity: l.quantity,
          unitCost: l.unitCost,
          taxRate: l.taxRate,
          batchNumber: l.batchNumber || null,
        })),
        discountAmount,
        paymentMethod,
        notes,
      });
      show("Purchase invoice created — stock updated", "success");
      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to create purchase", "error");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedSupplier(0);
    setInvoiceNum("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setPaymentMethod("CREDIT");
    setDiscountAmount(0);
    setNotes("");
    setLines([]);
  }

  const filtered = purchases.filter(
    (p) =>
      p.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: "bg-warning-light text-warning",
    partial: "bg-brand-light text-brand",
    paid: "bg-success-light text-success",
    returned: "bg-danger-light text-danger",
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        title="Purchase Bills"
        subtitle={`${purchases.length} purchase invoices`}
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>New Purchase</Button>}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice number or supplier..."
          className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-text-tertiary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-text-tertiary">Loading purchases...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm font-medium text-foreground">{search ? "No matching purchases" : "No purchases yet"}</p>
          <p className="text-xs text-text-tertiary mt-1">{search ? "Try a different search" : "Record your first purchase to track stock and supplier dues"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-foreground">{p.invoiceNumber}</td>
                  <td className="text-text-secondary">{p.supplier?.name}</td>
                  <td className="text-text-secondary">{formatDate(p.date)}</td>
                  <td className="text-text-secondary">{p.items.length}</td>
                  <td className="font-medium text-foreground">{formatMoney(p.totalAmount)}</td>
                  <td className="text-text-secondary">{formatMoney(p.amountPaid)}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[p.status] || ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.status === "pending" || p.status === "partial" ? (
                      <button
                        onClick={async () => {
                          const amt = prompt(`Payment for ${p.invoiceNumber} (outstanding: ${formatMoney(p.totalAmount - p.amountPaid)})`);
                          if (!amt) return;
                          try {
                            await api.post(`/suppliers/purchases/${p.id}/pay`, { amount: Number(amt), paymentMethod: "CASH" });
                            show("Payment recorded", "success");
                            loadAll();
                          } catch (err) {
                            show(err instanceof ApiError ? err.message : "Payment failed", "error");
                          }
                        }}
                        className="rounded p-1 text-text-tertiary hover:bg-success-light hover:text-success"
                        title="Record payment"
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Purchase Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">New Purchase Invoice</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-foreground mb-1 block">Supplier</label>
                  <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(Number(e.target.value))} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-foreground">
                    <option value={0}>Select supplier...</option>
                    {suppliers.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <Field label="Supplier Invoice #" value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Purchase Date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                <Field label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <div>
                  <label className="text-[13px] font-medium text-foreground mb-1 block">Payment Mode</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-foreground">
                    <option value="CREDIT">Credit</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Items</h3>
                  <Button type="button" variant="secondary" size="sm" onClick={addLine}>Add Item</Button>
                </div>
                {lines.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-tertiary">Click &quot;Add Item&quot; to begin</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex items-end gap-2 rounded-lg border border-border p-2">
                        <div className="flex-1">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Product</label>
                          <select value={line.productId} onChange={(e) => updateLine(idx, "productId", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]">
                            <option value={0}>Select...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-20">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Qty</label>
                          <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]" />
                        </div>
                        <div className="w-24">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Unit Cost</label>
                          <input type="number" min={0} step={0.01} value={line.unitCost} onChange={(e) => updateLine(idx, "unitCost", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]" />
                        </div>
                        <div className="w-16">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">GST %</label>
                          <input type="number" min={0} value={line.taxRate} onChange={(e) => updateLine(idx, "taxRate", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]" />
                        </div>
                        <div className="w-24">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Batch #</label>
                          <input type="text" value={line.batchNumber} onChange={(e) => updateLine(idx, "batchNumber", e.target.value)} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]" />
                        </div>
                        <div className="w-24 text-right text-[12px] font-medium text-foreground pb-2">
                          {formatMoney(line.unitCost * line.quantity + (line.unitCost * line.quantity * line.taxRate) / 100)}
                        </div>
                        <button type="button" onClick={() => removeLine(idx)} className="rounded p-1 text-text-tertiary hover:text-danger pb-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="rounded-lg border border-border bg-surface-muted p-3">
                <div className="flex justify-between text-sm"><span className="text-text-secondary">Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-secondary">Discount</span><span>- {formatMoney(discountAmount)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-secondary">GST</span><span>{formatMoney(totalTax)}</span></div>
                <div className="my-1 border-t border-border" />
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatMoney(total)}</span></div>
              </div>

              <Field label="Discount Amount" type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} />
              <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Purchase"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
