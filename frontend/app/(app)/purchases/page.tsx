"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search, Receipt, CreditCard, Percent, IndianRupee, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import type { Supplier, PurchaseInvoice, Product } from "@/lib/types";

interface PurchaseLine {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  discountType: "" | "percent" | "amount";
  discountValue: number;
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
  const [payTarget, setPayTarget] = useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [returnTarget, setReturnTarget] = useState<PurchaseInvoice | null>(null);
  const [returnItems, setReturnItems] = useState<{ purchaseItemId: number; name: string; maxQty: number; qty: number }[]>([]);

  // Form state
  const [selectedSupplier, setSelectedSupplier] = useState<number>(0);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CREDIT");
  const [billDiscountType, setBillDiscountType] = useState<"" | "percent" | "amount">("");
  const [billDiscountValue, setBillDiscountValue] = useState(0);
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
    setLines([...lines, { productId: 0, name: "", quantity: 1, unitCost: 0, taxRate: 0, discountType: "", discountValue: 0, batchNumber: "" }]);
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

  // Per-item calculations
  function getLineNet(l: PurchaseLine) {
    const base = l.unitCost * l.quantity;
    let disc = 0;
    if (l.discountType === "percent") disc = Math.round(base * l.discountValue / 100 * 100) / 100;
    else if (l.discountType === "amount") disc = Math.min(l.discountValue, base);
    return base - disc;
  }

  const subtotal = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const totalItemDiscount = lines.reduce((s, l) => {
    const base = l.unitCost * l.quantity;
    if (l.discountType === "percent") return s + Math.round(base * l.discountValue / 100 * 100) / 100;
    if (l.discountType === "amount") return s + Math.min(l.discountValue, base);
    return s;
  }, 0);
  const netAfterItemDiscount = subtotal - totalItemDiscount;
  const totalTax = lines.reduce((s, l) => s + (getLineNet(l) * l.taxRate) / 100, 0);
  // Bill-level discount
  let billDiscount = 0;
  if (billDiscountType === "percent") billDiscount = Math.round(netAfterItemDiscount * billDiscountValue / 100 * 100) / 100;
  else if (billDiscountType === "amount") billDiscount = billDiscountValue;
  const total = netAfterItemDiscount - billDiscount + totalTax;

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
          discountType: l.discountType || null,
          discountValue: l.discountValue,
          batchNumber: l.batchNumber || null,
        })),
        discountType: billDiscountType || null,
        discountAmount: billDiscountValue,
        paymentMethod,
        notes,
      });
      show("Purchase invoice created — stock updated", "success");
      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err) {
      show(describeApiError(err, "Failed to create purchase"), "error");
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
    setBillDiscountType("");
    setBillDiscountValue(0);
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

  const statusLabels: Record<string, string> = {
    pending: "Unpaid",
    partial: "Partially paid",
    paid: "Fully paid",
    returned: "Returned",
  };

  async function recordPayment() {
    if (!payTarget) return;
    if (payAmount <= 0) return show("Enter a valid amount", "error");
    const outstanding = payTarget.totalAmount - payTarget.amountPaid;
    if (payAmount > outstanding) return show(`Cannot pay more than outstanding (${formatMoney(outstanding)})`, "error");
    try {
      await api.post(`/suppliers/purchases/${payTarget.id}/pay`, { amount: payAmount, paymentMethod: payMethod });
      show("Payment recorded successfully", "success");
      setPayTarget(null);
      setPayAmount(0);
      loadAll();
    } catch (err) {
      show(describeApiError(err, "Could not record payment. Please try again."), "error");
    }
  }

  function openReturn(p: PurchaseInvoice) {
    setReturnTarget(p);
    setReturnItems(p.items.map((item: any) => ({
      purchaseItemId: item.id,
      name: item.name,
      maxQty: item.quantity,
      qty: 0,
    })));
  }

  async function submitReturn() {
    if (!returnTarget) return;
    const itemsToReturn = returnItems.filter((r) => r.qty > 0);
    if (itemsToReturn.length === 0) return show("Enter quantity to return for at least one item", "error");
    try {
      await api.post(`/suppliers/purchases/${returnTarget.id}/return`, {
        items: itemsToReturn.map((r) => ({ purchaseItemId: r.purchaseItemId, quantity: r.qty })),
      });
      show("Purchase return processed — stock adjusted", "success");
      setReturnTarget(null);
      loadAll();
    } catch (err) {
      show(describeApiError(err, "Return failed"), "error");
    }
  }

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
                <th>Discount</th>
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
                  <td className="text-text-secondary">{p.discountAmount > 0 ? formatMoney(p.discountAmount) : "—"}</td>
                  <td className="font-medium text-foreground">{formatMoney(p.totalAmount)}</td>
                  <td className="text-text-secondary">{formatMoney(p.amountPaid)}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[p.status] || ""}`}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td>
                    {p.status === "pending" || p.status === "partial" ? (
                      <button
                        onClick={() => {
                          setPayTarget(p);
                          setPayAmount(p.totalAmount - p.amountPaid);
                          setPayMethod("CASH");
                        }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-success-light hover:text-success transition-colors"
                        title="Record payment"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Pay
                      </button>
                    ) : null}
                    {p.status !== "returned" ? (
                      <button
                        onClick={() => openReturn(p)}
                        className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-danger-light hover:text-danger transition-colors"
                        title="Return items"
                      >
                        Return
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
          <div className="w-full max-w-4xl rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
                    {lines.map((line, idx) => {
                      const base = line.unitCost * line.quantity;
                      let itemDisc = 0;
                      if (line.discountType === "percent") itemDisc = Math.round(base * line.discountValue / 100 * 100) / 100;
                      else if (line.discountType === "amount") itemDisc = Math.min(line.discountValue, base);
                      const net = base - itemDisc;
                      const tax = Math.round(net * line.taxRate / 100 * 100) / 100;

                      return (
                        <div key={idx} className="rounded-lg border border-border p-2">
                          <div className="flex items-end gap-2">
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
                            <button type="button" onClick={() => removeLine(idx)} className="rounded p-1 text-text-tertiary hover:text-danger pb-2">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Per-item discount row */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[11px] text-text-secondary">Discount:</span>
                            <select
                              value={line.discountType}
                              onChange={(e) => updateLine(idx, "discountType", e.target.value)}
                              className="h-7 w-24 rounded border border-border bg-surface-muted px-2 text-[11px]"
                            >
                              <option value="">None</option>
                              <option value="percent">%</option>
                              <option value="amount">Amount</option>
                            </select>
                            {line.discountType ? (
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={line.discountValue}
                                onChange={(e) => updateLine(idx, "discountValue", Number(e.target.value))}
                                className="h-7 w-20 rounded border border-border bg-surface-muted px-2 text-[11px]"
                                placeholder={line.discountType === "percent" ? "%" : "Amt"}
                              />
                            ) : null}
                            <div className="ml-auto flex items-center gap-3 text-[12px]">
                              {itemDisc > 0 && <span className="text-danger">-{formatMoney(itemDisc)}</span>}
                              <span className="font-medium text-foreground">{formatMoney(net + tax)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="rounded-lg border border-border bg-surface-muted p-3">
                <div className="flex justify-between text-sm"><span className="text-text-secondary">Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                {totalItemDiscount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-text-secondary">Item discounts</span><span className="text-danger">- {formatMoney(totalItemDiscount)}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-text-secondary">GST</span><span>{formatMoney(totalTax)}</span></div>
                <div className="my-1 border-t border-border" />
                <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatMoney(total)}</span></div>
              </div>

              {/* Bill-level discount */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-[13px] font-medium text-foreground mb-2">Bill Discount</p>
                <div className="flex items-center gap-2">
                  <select
                    value={billDiscountType}
                    onChange={(e) => setBillDiscountType(e.target.value as "" | "percent" | "amount")}
                    className="h-8 w-28 rounded border border-border bg-surface-muted px-2 text-[12px]"
                  >
                    <option value="">None</option>
                    <option value="percent">% of subtotal</option>
                    <option value="amount">Flat amount</option>
                  </select>
                  {billDiscountType ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={billDiscountValue}
                      onChange={(e) => setBillDiscountValue(Number(e.target.value))}
                      className="h-8 w-24 rounded border border-border bg-surface-muted px-2 text-[12px]"
                      placeholder={billDiscountType === "percent" ? "%" : "Amount"}
                    />
                  ) : null}
                  {billDiscount > 0 && <span className="text-[12px] text-danger font-medium">- {formatMoney(billDiscount)}</span>}
                </div>
              </div>

              <Field label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Purchase"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Dialog open={!!payTarget} onClose={() => setPayTarget(null)} title="Record Payment">
        {payTarget && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-muted p-3 text-sm">
              <p className="text-text-secondary">Invoice: <strong className="text-foreground">{payTarget.invoiceNumber}</strong></p>
              <p className="text-text-secondary">Supplier: <strong className="text-foreground">{payTarget.supplier?.name}</strong></p>
              <p className="text-text-secondary">Outstanding: <strong className="text-danger">{formatMoney(payTarget.totalAmount - payTarget.amountPaid)}</strong></p>
            </div>
            <Field label="Payment Amount" type="number" min={0} step={0.01} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            <div>
              <label className="text-[13px] font-medium text-foreground mb-1 block">Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-foreground">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={recordPayment}>Record Payment</Button>
              <Button variant="secondary" onClick={() => setPayTarget(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Return Modal */}
      <Dialog open={!!returnTarget} onClose={() => setReturnTarget(null)} title="Purchase Return">
        {returnTarget && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-muted p-3 text-sm">
              <p className="text-text-secondary">Invoice: <strong className="text-foreground">{returnTarget.invoiceNumber}</strong></p>
              <p className="text-text-secondary">Supplier: <strong className="text-foreground">{returnTarget.supplier?.name}</strong></p>
            </div>
            <p className="text-sm text-foreground">Enter quantity to return for each item:</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-auto">
              {returnItems.map((r, i) => (
                <div key={r.purchaseItemId} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-foreground truncate">{r.name}</span>
                  <span className="text-xs text-text-secondary">Max: {r.maxQty}</span>
                  <input
                    type="number"
                    min={0}
                    max={r.maxQty}
                    value={r.qty || ""}
                    onChange={(e) => {
                      const val = Math.min(Math.max(0, Number(e.target.value) || 0), r.maxQty);
                      setReturnItems((prev) => prev.map((item, idx) => idx === i ? { ...item, qty: val } : item));
                    }}
                    className="h-8 w-20 rounded border border-border bg-surface px-2 text-sm text-right text-foreground"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={submitReturn}>Process Return</Button>
              <Button variant="secondary" onClick={() => setReturnTarget(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
