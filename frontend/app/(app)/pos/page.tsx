"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Minus, Plus, ScanBarcode, Trash2, Search, Star, CheckCircle2, X,
  ArrowLeft, RotateCcw, Banknote, CreditCard, Smartphone, CircleDollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ReceiptActions } from "@/components/ReceiptActions";
import { ReturnPanel, type ReturnDraftLine } from "@/components/ReturnPanel";
import { QuantityPopover } from "@/components/QuantityPopover";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useProducts } from "@/hooks/useProducts";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney, round2 } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { effectivePrice, quoteSale } from "@/lib/quote";
import { loadDrafts, saveDraft, deleteDraft } from "@/lib/drafts";
import { loadDraftsLocal, saveDraftLocal, deleteDraftLocal } from "@/lib/drafts-local";
import type { CartItem, Customer, Invoice, PaymentMethod, Product } from "@/lib/types";

interface PaymentLine {
  method: PaymentMethod;
  amount: number;
}

function isInputFocused() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export default function PosPage() {
  const { data: shop } = useShopSettings();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const posRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [duePaid, setDuePaid] = useState("");
  const [returnLines, setReturnLines] = useState<ReturnDraftLine[]>([]);
  const [refundMode, setRefundMode] = useState<"CASH" | "CREDIT">("CASH");
  const [useCredit, setUseCredit] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "amount" | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: "CASH", amount: 0 }]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ id: number; invoiceNumber: string; totalAmount: number; changeDue: number; payments: { method: string; amount: number }[] } | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showShutdownDialog, setShowShutdownDialog] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [focusedCartIndex, setFocusedCartIndex] = useState<number | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<{ id: number; state: Record<string, unknown>; updatedAt: string } | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const billIdRef = useRef(`bill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const draftDbIdRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // Crash recovery: check for existing drafts on mount
  useEffect(() => {
    (async () => {
      try {
        let draft: { id: number; state: Record<string, unknown>; updatedAt: string } | null = null;
        try {
          const all = await loadDrafts();
          draft = all.find((d) => d.billId && d.billId !== billIdRef.current && ((d.state as any)?.cartItems?.length ?? 0) > 0) ?? null;
        } catch {}
        if (!draft) {
          try {
            const allLocal = await loadDraftsLocal();
            draft = allLocal.find((d) => d.billId && d.billId !== billIdRef.current && ((d.state as any)?.cartItems?.length ?? 0) > 0) ?? null;
          } catch {}
        }
        if (draft) {
          setRecoveryDraft(draft);
          setShowRecoveryDialog(true);
        }
      } catch {}
      mountedRef.current = true;
    })();
  }, []);

  // Auto-save bill state every 5 seconds (debounced)
  useEffect(() => {
    if (!mountedRef.current) return;
    if (cart.length === 0 && !customerName && !customerPhone) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const state = { cart, customerName, customerPhone, discountType, discountValue, payments, pointsRedeemed, duePaid: Number(duePaid) || 0, returns: returnLines };
      try { await saveDraft(billIdRef.current, "Current Bill", state); } catch {}
      try { await saveDraftLocal({ id: draftDbIdRef.current ?? 0, billId: billIdRef.current, label: "Current Bill", isHeld: false, state, updatedAt: new Date().toISOString() }); } catch {}
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }, 5000);
    setAutoSaveStatus("saving");
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [cart, customerName, customerPhone, discountType, discountValue, payments, pointsRedeemed, duePaid, returnLines]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedQuery(manualQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [manualQuery]);
  const { data: manualResults } = useProducts(committedQuery);

  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const quote = useMemo(
    () => quoteSale({ cart, discountType, discountValue, pointsRedeemed, settings: shop }),
    [cart, discountType, discountValue, pointsRedeemed, shop]
  );

  const dueToClear = customer ? Math.min(Math.max(0, Number(duePaid) || 0), customer.totalDue) : 0;
  const returnTotal = round2(returnLines.reduce((s, l) => s + l.refundAmount, 0));
  const creditAvail = customer?.creditBalance ?? 0;
  const creditUse = useCredit ? round2(Math.min(creditAvail, Math.max(0, quote.total - returnTotal))) : 0;
  const netBill = round2(quote.total - returnTotal - creditUse);
  const payable = Math.max(0, netBill);
  const grossRefund = Math.max(0, round2(-netBill));

  // Split payments calculations
  const totalTendered = round2(payments.reduce((s, p) => s + p.amount, 0));
  const cashTendered = round2(payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0));

  const pool = round2(totalTendered + grossRefund);
  const amountAppliedToGoods = round2(Math.min(pool, payable));
  const afterGoods = round2(Math.max(0, pool - amountAppliedToGoods));
  const duePaidFinal = round2(Math.min(dueToClear, afterGoods));
  const leftover = round2(Math.max(0, afterGoods - duePaidFinal));
  const changeDue = grossRefund === 0 && totalTendered > 0 ? round2(Math.max(0, totalTendered - amountAppliedToGoods - duePaidFinal)) : 0;
  const refundValue = grossRefund > 0 ? leftover : 0;
  const collectTotal = round2(payable + dueToClear);
  const remainingToPay = round2(Math.max(0, collectTotal - totalTendered));
  const shortNow =
    totalTendered > 0 && grossRefund === 0
      ? Math.max(0, round2(collectTotal - totalTendered))
      : 0;

  const addToCart = useCallback(
    (product: Product) => {
      setCompletedSale(null);
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (!existing) return [...prev, { product, quantity: 1 }];
        if (existing.quantity >= product.stock) {
          show(`Only ${product.stock} in stock for "${product.name}"`, "error");
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      });
      setFocusedCartIndex(null);
    },
    [show]
  );

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
        addToCart(product);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) show("Product not found. Please add to inventory.", "error");
        else show("Barcode lookup failed", "error");
      }
    },
    [addToCart, show]
  );

  async function lookupCustomer(phoneOverride?: string) {
    const phone = (phoneOverride ?? customerPhone).trim();
    if (!phone) return;
    try {
      const c = await api.get<Customer>(`/customers/phone/${encodeURIComponent(phone)}`);
      setCustomer(c);
      setCustomerName(c.name);
      setDuePaid("");
      show(`${c.name} \u2014 ${c.loyaltyPoints} points`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCustomer(null);
        show("New customer \u2014 will be created on checkout", "info");
      } else {
        show("Customer lookup failed", "error");
      }
    }
  }

  function onReturnInvoiceFound(info: { customerPhone: string | null; customerName: string }) {
    if (!info.customerPhone) return;
    setCustomerPhone(info.customerPhone);
    setCustomerName(info.customerName);
    if (customer?.phone !== info.customerPhone) lookupCustomer(info.customerPhone);
  }

  const resetSale = () => {
    setCart([]);
    setCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setDuePaid("");
    setReturnLines([]);
    setRefundMode("CASH");
    setUseCredit(false);
    setDiscountType(null);
    setDiscountValue(0);
    setPointsRedeemed(0);
    setPayments([{ method: "CASH", amount: 0 }]);
    setFocusedCartIndex(null);
  };

  const canFinalize = cart.length > 0 || returnLines.length > 0 || dueToClear > 0;

  const finalizeSale = useCallback(async () => {
    if (!canFinalize || isCheckingOut) return;
    setIsCheckingOut(true);
    setShowShutdownDialog(false);
    try {
      const returnsPayload = Object.values(
        returnLines.reduce(
          (acc, l) => {
            (acc[l.invoiceId] ??= { invoiceId: l.invoiceId, items: [] }).items.push({
              invoiceItemId: l.invoiceItemId,
              quantity: l.quantity,
              refundAmount: l.refundAmount,
            });
            return acc;
          },
          {} as Record<number, { invoiceId: number; items: { invoiceItemId: number; quantity: number; refundAmount: number }[] }>
        )
      );

      const invoice = await api.post<Invoice>("/invoices", {
        customerName,
        customerPhone,
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        discountType,
        discountValue: Number(discountValue) || 0,
        pointsRedeemed: Number(pointsRedeemed) || 0,
        payments: payments.filter((p) => p.amount > 0),
        duePaid: dueToClear,
        returns: returnsPayload,
        refundMode,
        creditApplied: creditUse,
      });

      const parts = [`${invoice.invoiceNumber} \u00b7 ${money(invoice.totalAmount)}`];
      if (invoice.previousDuePaid > 0) parts.push(`${money(invoice.previousDuePaid)} due cleared`);
      if (invoice.refundValue > 0)
        parts.push(`${money(invoice.refundValue)} refunded (${invoice.refundMode === "CREDIT" ? "store credit" : "cash"})`);
      if (invoice.discountAmount > 0) parts.push(`${money(invoice.discountAmount)} discount applied`);
      show(`Done \u2014 ${parts.join(" \u00b7 ")}`, "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCompletedSale({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        changeDue: invoice.changeDue,
        payments: payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount })),
      });
      resetSale();
      // Clear draft after successful checkout
      try { if (draftDbIdRef.current) await deleteDraft(draftDbIdRef.current); } catch {}
      try { if (draftDbIdRef.current) await deleteDraftLocal(draftDbIdRef.current); } catch {}
      draftDbIdRef.current = null;
      if (shop?.autoPrintReceipt) {
        if (shop.autoPrintMethod === "usb") {
          api.post(`/print/${invoice.id}/usb`).catch((err) =>
            show(err instanceof ApiError ? err.message : "Auto-print to USB printer failed", "error")
          );
        } else {
          setTimeout(() => openReceiptPrint(invoice.id), 0);
        }
      }
    } catch (err) {
      show(describeApiError(err, "Checkout failed"), "error");
    } finally {
      setIsCheckingOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, returnLines, refundMode, creditUse, customerName, customerPhone, discountType, discountValue, pointsRedeemed, payments, dueToClear, canFinalize, isCheckingOut, queryClient, show, shop?.autoPrintReceipt, shop?.autoPrintMethod]);

  useBarcodeScanner({
    onScan: handleScan,
    onManualEnter: (event) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (editable) return;
      finalizeSale();
    },
  });

  function updateQuantity(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty > item.product.stock) {
            show(`Only ${item.product.stock} in stock for "${item.product.name}"`, "error");
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
    setFocusedCartIndex(null);
  }

  function removeFromCart(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    setFocusedCartIndex(null);
  }

  function setQuantityDirect(productId: number, qty: number) {
    if (qty <= 0) { removeFromCart(productId); return; }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const capped = Math.min(qty, item.product.stock);
        if (capped <= 0) return item;
        return { ...item, quantity: capped };
      })
    );
    setFocusedCartIndex(null);
  }

  const maxRedeemable = customer && shop?.loyaltyEnabled ? customer.loyaltyPoints : 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.key === "F5") { e.preventDefault(); resetSale(); show("Cart cleared", "info"); }
      if (e.key === "F6") { e.preventDefault(); const phone = posRef.current?.querySelector('input[placeholder*="Phone"]') as HTMLElement | null; if (phone) phone.focus(); }
      if (e.key === "F7") { e.preventDefault(); const disc = posRef.current?.querySelector('select[aria-label="Discount type"]') as HTMLElement | null; if (disc) disc.focus(); }
      if (e.key === "F12" || e.key === "End") { e.preventDefault(); finalizeSale(); }
      if (e.key === "Escape") { e.preventDefault(); setCompletedSale(null); setShowShutdownDialog(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === " ") { e.preventDefault(); const search = posRef.current?.querySelector('input[placeholder*="Scan or type"]') as HTMLElement | null; if (search) search.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [finalizeSale, resetSale, show]);

  return (
    <div ref={posRef} className="flex flex-col gap-4 h-full">
      {/* POS Header */}
      <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-light px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <ScanBarcode className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-brand">POS Checkout</h1>
            <p className="text-[11px] text-text-secondary">F1 Help · F5 New · F6 Customer · F7 Discount · F12 Checkout</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {autoSaveStatus === "saving" && (
            <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-light px-3 py-1 text-xs font-medium text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              Saving…
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success-light px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowShutdownDialog(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-brand/10 hover:text-brand transition-colors"
            aria-label="Shutdown"
            title="Shutdown (Ctrl+Q)"
          >
            <ScanBarcode className="h-5 w-5" />
          </button>
        </div>
      </div>

      {completedSale && (
        <Card variant="success" className="flex flex-col gap-4 p-5 animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">
                {completedSale.invoiceNumber} · {money(completedSale.totalAmount)}
              </p>
              <p className="text-sm text-text-secondary">
                {shop?.autoPrintReceipt ? "Sale complete — receipt sent to print." : "Sale complete — print or download the receipt below."}
              </p>
            </div>
          </div>

          {/* Payment breakdown */}
          {completedSale.payments.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">Payment Received</p>
              <div className="flex flex-col gap-1">
                {completedSale.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      {p.method === "CASH" && <Banknote className="h-3.5 w-3.5 text-success" />}
                      {p.method === "UPI" && <Smartphone className="h-3.5 w-3.5 text-brand" />}
                      {p.method === "CARD" && <CreditCard className="h-3.5 w-3.5 text-warning" />}
                      {p.method}
                    </span>
                    <span className="font-medium text-foreground">{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Balance to return — prominent for cashier */}
          {completedSale.changeDue > 0 && (
            <div className="rounded-lg border-2 border-warning/30 bg-warning/10 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-1">Return Balance to Customer</p>
              <p className="text-3xl font-bold text-warning">{money(completedSale.changeDue)}</p>
              <p className="text-[11px] text-warning/70 mt-1">Count and return this amount</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <ReceiptActions invoiceId={completedSale.id} />
            <Button type="button" variant="ghost" onClick={() => setCompletedSale(null)}>
              New sale
            </Button>
          </div>
        </Card>
      )}

      {showShutdownDialog && (
        <Card variant="warning" className="p-6 max-w-md mx-auto animate-scale-in">
          <h2 className="text-lg font-bold text-foreground mb-2">Backup before closing?</h2>
          <p className="text-sm text-text-secondary mb-5">Create a database backup before ending the session.</p>
          <div className="flex gap-3">
            <Button type="button" variant="primary" onClick={async () => { try { await api.post("/backup/run"); show("Backup complete", "success"); } catch { show("Backup failed", "error"); } setShowShutdownDialog(false); finalizeSale(); }}>
              Backup & Close
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setShowShutdownDialog(false); finalizeSale(); }}>
              Close Without Backup
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowShutdownDialog(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {showRecoveryDialog && recoveryDraft && (
        <Card variant="brand" className="p-6 max-w-md mx-auto animate-scale-in">
          <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-brand" />
            Recover previous bill?
          </h2>
          <p className="text-sm text-text-secondary mb-1">
            An unsaved bill was found from a previous session.
          </p>
          <p className="text-xs text-text-tertiary mb-5">
            {((recoveryDraft.state as any)?.cartItems?.length ?? 0)} items · Last saved {new Date(recoveryDraft.updatedAt).toLocaleString("en-IN")}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="primary" onClick={() => {
              const s = recoveryDraft.state as any;
              if (s.cart) setCart(s.cart);
              if (s.customerName) setCustomerName(s.customerName);
              if (s.customerPhone) setCustomerPhone(s.customerPhone);
              if (s.discountType) setDiscountType(s.discountType);
              if (s.discountValue) setDiscountValue(s.discountValue);
              if (s.payments) setPayments(s.payments);
              if (s.pointsRedeemed) setPointsRedeemed(s.pointsRedeemed);
              if (s.duePaid) setDuePaid(String(s.duePaid));
              if (s.returns) setReturnLines(s.returns);
              setShowRecoveryDialog(false);
              show("Bill restored", "success");
            }}>
              Restore bill
            </Button>
            <Button type="button" variant="secondary" onClick={async () => {
              try { await deleteDraft(recoveryDraft.id); } catch {}
              try { await deleteDraftLocal(recoveryDraft.id); } catch {}
              setShowRecoveryDialog(false);
              show("Previous bill discarded", "info");
            }}>
              Discard
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 flex-1 overflow-hidden">
        {/* Cart */}
        <Card className="p-4 lg:col-span-2 flex flex-col overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Cart</h2>
            <span className="text-xs text-text-tertiary">Click qty to edit · Del to remove</span>
          </div>

          <div className="relative mb-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/50 px-3 py-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all">
              <ScanBarcode className="h-4 w-4 shrink-0 text-text-tertiary" />
              <input
                ref={qtyInputRef}
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Scan barcode or type product name…"
                aria-label="Add product manually"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary"
              />
              {manualQuery && (
                <button type="button" aria-label="Clear search" onClick={() => setManualQuery("")} className="text-foreground/40 hover:text-foreground">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {committedQuery && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface shadow-xl animate-scale-in">
                {!manualResults ? (
                  <p className="px-3 py-2.5 text-sm text-foreground/50">Searching\u2026</p>
                ) : manualResults.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-foreground/50">No products match.</p>
                ) : (
                  manualResults.slice(0, 8).map((p) => {
                    const outOfStock = p.stock <= 0 && !shop?.allowNegativeStock;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => { addToCart(p); setManualQuery(""); setCommittedQuery(""); }}
                        className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {p.name}
                          {p.barcode && <span className="ml-1.5 font-normal text-foreground/40">\u00b7 {p.barcode}</span>}
                        </span>
                        <span className="shrink-0 text-foreground/70">{money(effectivePrice(p))}</span>
                        <span className={`shrink-0 text-xs ${outOfStock ? "text-danger" : "text-foreground/40"}`}>
                          {outOfStock ? "Out of stock" : `${p.stock} in stock`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-brand mb-4">
                <ScanBarcode className="h-8 w-8" />
              </div>
              <p className="text-base font-medium text-foreground">Cart is empty</p>
              <p className="text-sm text-text-tertiary mt-1">Scan a product or type to search</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-text-tertiary">
                    <th className="pb-2 pr-2 font-semibold">Item</th>
                    <th className="pb-2 pr-2 font-semibold">MRP</th>
                    <th className="pb-2 pr-2 font-semibold">Sell @</th>
                    <th className="pb-2 pr-2 font-semibold">Qty</th>
                    {shop?.gstEnabled && <th className="pb-2 pr-2 text-right font-semibold">GST</th>}
                    <th className="pb-2 pr-2 text-right font-semibold">Total</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {cart.map((item, idx) => (
                    <tr
                      key={item.product.id}
                      className={`transition-colors hover:bg-surface-muted/50 ${focusedCartIndex === idx ? "bg-brand/5" : ""}`}
                    >
                      <td className="py-2 pr-2 font-medium text-foreground max-w-[180px] truncate">
                        {item.product.name}
                        {item.product.unit && <span className="ml-1.5 font-normal text-foreground/40">({item.product.unit})</span>}
                      </td>
                      <td className="py-2 pr-2 text-foreground/50 text-xs">{money(item.product.purchasePrice)}</td>
                      <td className="py-2 pr-2 text-foreground/70 text-sm">{money(effectivePrice(item.product))}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                          <QuantityPopover
                            product={item.product}
                            quantity={item.quantity}
                            onSetQuantity={(q) => setQuantityDirect(item.product.id, q)}
                          />
                        </div>
                      </td>
                      {shop?.gstEnabled && (
                        <td className="py-2 pr-2 text-right text-foreground/50">{item.product.taxRate}%</td>
                      )}
                      <td className="py-2 pr-2 text-right font-medium text-foreground">
                        {money(effectivePrice(item.product) * item.quantity)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Remove ${item.product.name} entirely`}
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-foreground/40 hover:text-danger transition-colors"
                          title="Remove item (Del)"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Checkout panel */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Customer */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Customer [F6]</h2>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Phone" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setCustomer(null); setPointsRedeemed(0); }} placeholder="For loyalty" />
              </div>
              <Button type="button" variant="secondary" onClick={() => lookupCustomer()} aria-label="Find customer">
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Field label="Name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in Customer" />
            {customer && customer.totalDue >= 0.01 && (
              <div className="rounded-lg bg-danger/10 p-3">
                <p className="text-sm font-medium text-danger">Owes {money(customer.totalDue)} from before</p>
                <p className="mt-0.5 text-xs text-foreground/60">Add any amount to this bill to clear it.</p>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="Clear previous due" type="number" min={0} max={customer.totalDue} step="0.01" value={duePaid} onChange={(e) => setDuePaid(e.target.value === "" ? "" : String(Math.min(Math.max(0, Number(e.target.value) || 0), customer.totalDue)))} placeholder="0.00" />
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setDuePaid(String(customer.totalDue))}>Full due</Button>
                </div>
              </div>
            )}
            {customer && creditAvail >= 0.01 && (
              <label className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                <span className="font-medium text-success">Use store credit ({money(creditAvail)})</span>
              </label>
            )}
            {customer && shop?.loyaltyEnabled && (
              <div className="rounded-lg bg-brand/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Star className="h-4 w-4 text-warning" aria-hidden="true" />
                  {customer.loyaltyPoints} points available
                </p>
                {maxRedeemable > 0 ? (
                  <>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex-1">
                        <Field label={`Redeem points`} type="number" min={0} max={maxRedeemable} value={pointsRedeemed || ""} onChange={(e) => setPointsRedeemed(Math.min(Number(e.target.value) || 0, maxRedeemable))} />
                      </div>
                      <Button type="button" variant="secondary" onClick={() => setPointsRedeemed(maxRedeemable)}>Use all</Button>
                    </div>
                    {pointsRedeemed > 0 && (
                      <p className="mt-1.5 text-xs text-success">{pointsRedeemed} pts = {money(pointsRedeemed * shop.pointValue)} off this sale</p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-foreground/50">Not enough points to redeem yet.</p>
                )}
              </div>
            )}
          </Card>

          {/* Returns / exchange */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Return / Exchange [F9]</h2>
            <ReturnPanel sym={sym} drafted={returnLines} onAdd={(lines) => setReturnLines((prev) => [...prev, ...lines])} onInvoiceFound={onReturnInvoiceFound} />
            {returnLines.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                {returnLines.map((l) => (
                  <div key={`${l.invoiceId}:${l.invoiceItemId}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1 truncate text-foreground/80">{l.quantity}\u00d7 {l.name} <span className="text-foreground/40">({l.invoiceNumber})</span></span>
                    <span className="text-foreground">- {money(l.refundAmount)}</span>
                    <button type="button" aria-label={`Remove return of ${l.name}`} onClick={() => setReturnLines((prev) => prev.filter((x) => !(x.invoiceId === l.invoiceId && x.invoiceItemId === l.invoiceItemId)))} className="text-foreground/40 hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Discount + payment */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Discount [F7]</h2>
            <div className="flex gap-2">
              <select aria-label="Discount type" value={discountType ?? ""} onChange={(e) => setDiscountType((e.target.value || null) as "percent" | "amount" | null)} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground">
                <option value="">None</option>
                <option value="percent">%</option>
                <option value="amount">{sym}</option>
              </select>
              <input type="number" min={0} step="0.01" disabled={!discountType} value={discountValue || ""} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} placeholder="Discount value" aria-label="Discount value" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground disabled:opacity-50" />
            </div>

            <h2 className="mt-2 text-base font-semibold text-foreground">Payment</h2>
            <div className="flex flex-col gap-2">
              {payments.map((line, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="w-28">
                    <label className="text-[11px] font-medium text-text-secondary mb-0.5 block">Method</label>
                    <select
                      value={line.method}
                      onChange={(e) => setPayments((prev) => prev.map((p, i) => i === idx ? { ...p, method: e.target.value as PaymentMethod } : p))}
                      className="h-9 w-full rounded border border-border bg-surface-muted px-2 text-[12px] font-medium text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-text-secondary mb-0.5 block">Amount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount || ""}
                      onChange={(e) => setPayments((prev) => prev.map((p, i) => i === idx ? { ...p, amount: Number(e.target.value) || 0 } : p))}
                      placeholder="0.00"
                      className="h-9 w-full rounded border border-border bg-surface-muted px-2 text-[12px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                    />
                  </div>
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
                      title="Remove payment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  const remaining = round2(collectTotal - payments.reduce((s, p) => s + p.amount, 0));
                  const nextMethod: PaymentMethod = payments.length > 0 && payments[payments.length - 1].method === "CASH" ? "UPI" : "CASH";
                  setPayments((prev) => [...prev, { method: nextMethod, amount: remaining > 0 ? remaining : 0 }]);
                }}
                disabled={remainingToPay <= 0}
                className="flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:border-brand hover:text-brand transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-3 w-3" />
                Split payment
              </button>
              {payments.length > 1 && (
                <span className="text-[11px] text-text-tertiary">
                  Total: {money(totalTendered)} / {money(collectTotal)}
                </span>
              )}
            </div>
            {remainingToPay > 0 && totalTendered > 0 && (
              <p className="rounded bg-warning/10 px-2 py-1.5 text-[11px] font-medium text-warning">
                Remaining: {money(remainingToPay)} to collect
              </p>
            )}
            {changeDue > 0 && (
              <p className="rounded bg-success/10 px-2 py-1.5 text-[11px] font-semibold text-success">
                Return {money(changeDue)} change to customer
              </p>
            )}
          </Card>

          {/* Totals */}
          <Card className="flex flex-col gap-2 p-4">
            {(() => {
              const adjusted = returnTotal > 0 || creditUse > 0 || dueToClear > 0 || (discountType && discountValue > 0);
              return (
                <>
                  <Row label={adjusted ? "This sale" : "Subtotal"} value={money(adjusted ? quote.total : quote.subtotal)} />
                  {quote.discountAmount > 0 && <Row label="Discount" value={`- ${money(quote.discountAmount)}`} />}
                  {!adjusted && shop?.gstEnabled && quote.taxAmount > 0 && <Row label="GST (included)" value={money(quote.taxAmount)} />}
                  {!adjusted && quote.loyaltyDiscount > 0 && <Row label="Loyalty" value={`- ${money(quote.loyaltyDiscount)}`} />}
                  {returnTotal > 0 && <Row label="Returns" value={`- ${money(returnTotal)}`} />}
                  {creditUse > 0 && <Row label="Store credit used" value={`- ${money(creditUse)}`} />}
                  {dueToClear > 0 && (
                    <Row label={duePaidFinal < dueToClear ? "Due to clear (needs full payment)" : "Previous due cleared"} value={money(duePaidFinal)} />
                  )}
                </>
              );
            })()}
            <div className="my-1 border-t border-border" />
            {refundValue > 0 ? (
              <div className="flex items-center justify-between rounded-xl bg-warning-light px-4 py-3 -mx-1">
                <span className="text-sm font-semibold text-warning">Refund ({refundMode === "CREDIT" ? "store credit" : "cash"})</span>
                <span className="text-2xl font-bold text-warning">{money(refundValue)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-light px-4 py-3 -mx-1">
                <span className="text-sm font-semibold text-brand">{returnTotal > 0 || creditUse > 0 || dueToClear > 0 ? "To Collect" : "Grand Total"}</span>
                <span className="text-2xl font-bold text-brand">{money(collectTotal)}</span>
              </div>
            )}
            {changeDue > 0 && (<Row label="Change" value={money(changeDue)} />)}
            {shortNow > 0 && (<p className={`rounded-lg px-3 py-2 text-xs font-medium ${customer ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>{customer ? `${money(shortNow)} short \u2014 unpaid part stays on ${customer.name}'s due` : `${money(shortNow)} short \u2014 add a customer to record as due`}</p>)}
            {shop?.loyaltyEnabled && customer && quote.pointsEarned > 0 && (<p className="text-xs text-foreground/50">Earns {quote.pointsEarned} points</p>)}
            <Button onClick={finalizeSale} disabled={!canFinalize || isCheckingOut} className="mt-2 w-full" size="lg">
              {isCheckingOut ? "Processing…" : "END SALE [F12]"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}