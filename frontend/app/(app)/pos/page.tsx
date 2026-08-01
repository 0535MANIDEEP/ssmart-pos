"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Minus, Plus, ScanBarcode, Trash2, Search, Star, CheckCircle2, X,
  ArrowLeft, RotateCcw, Banknote, CreditCard, Smartphone, CircleDollarSign,
  Power, HelpCircle, WifiOff,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ReceiptActions } from "@/components/ReceiptActions";
import { BillConfirmDialog } from "@/components/BillConfirmDialog";
import { ReturnPanel, type ReturnDraftLine } from "@/components/ReturnPanel";
import { QuantityPopover } from "@/components/QuantityPopover";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { ProductSearch } from "@/components/ProductSearch";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney, round2 } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { effectivePrice, quoteSale } from "@/lib/quote";
import { loadDrafts, saveDraft, deleteDraft } from "@/lib/drafts";
import { loadDraftsLocal, saveDraftLocal, deleteDraftLocal } from "@/lib/drafts-local";
import { getProductByBarcode, saveOfflineInvoice, updateProductStock, findCustomerByPhone, type OfflineProduct } from "@/lib/offline-store";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { printOfflineReceipt } from "@/lib/offline-receipt";
import type { CartItem, Customer, Invoice, PaymentMethod, Product, Salesman } from "@/lib/types";

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
  const isOnline = useOnlineStatus();

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [focusedCartIndex, setFocusedCartIndex] = useState<number | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<{ id: number; state: Record<string, unknown>; updatedAt: string } | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [heldBills, setHeldBills] = useState<{ id: string; cart: CartItem[]; customerName: string; customerPhone: string; discountType: "percent" | "amount" | null; discountValue: number; timestamp: number }[]>(() => {
    try {
      const saved = localStorage.getItem("ssmart-held-bills");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [salesmanId, setSalesmanId] = useState<number | null>(null);
  const { data: salesmen = [] } = useQuery<Salesman[]>({ queryKey: ["salesmen"], queryFn: () => api.get<Salesman[]>("/salesmen"), enabled: true });
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
  const paymentDerived = useMemo(() => {
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
    const shortNow = totalTendered > 0 && grossRefund === 0 ? Math.max(0, round2(collectTotal - totalTendered)) : 0;
    return { totalTendered, cashTendered, pool, amountAppliedToGoods, afterGoods, duePaidFinal, leftover, changeDue, refundValue, collectTotal, remainingToPay, shortNow };
  }, [payments, grossRefund, payable, dueToClear]);

  const { totalTendered, changeDue, refundValue, collectTotal, remainingToPay, shortNow, duePaidFinal } = paymentDerived;

  const addToCart = useCallback(
    (product: Product) => {
      setCompletedSale(null);
      setCart((prev) => {
        // For packed products, effective stock = bulk parent stock / packSize
        let effectiveStock = product.stock;
        if (product.bulkProductId && product.packSize && product.packSize > 0) {
          // The bulk product stock is fetched separately — for now use product.stock
          // which the backend should have set to bulk-equivalent
          effectiveStock = product.stock;
        }

        const existing = prev.find((item) => item.product.id === product.id);
        if (!existing) return [...prev, { product, quantity: 1, rateTier: customer?.rateTier || "B", discountType: null, discountValue: 0 }];
        if (existing.quantity >= effectiveStock) {
          show(`Only ${effectiveStock} in stock for "${product.name}"`, "error");
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      });
      // Loss warning: selling below cost
      const rateTier = customer?.rateTier || "B";
      const ep = effectivePrice(product, rateTier);
      if (product.purchasePrice > 0 && ep < product.purchasePrice) {
        show(`LOSS: "${product.name}" selling at ${money(ep)} but cost is ${money(product.purchasePrice)}`, "error");
      }
      setFocusedCartIndex(null);
    },
    [show, customer]
  );

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
        addToCart(product);
      } catch (err) {
        // If offline or network error, try local IndexedDB
        if (!navigator.onLine || (err instanceof ApiError && err.status === 0)) {
          const localProduct = await getProductByBarcode(code);
          if (localProduct) {
            addToCart(localProduct as unknown as Product);
            return;
          }
          show("Offline — product not found in local cache. Connect to internet to sync products.", "error");
          return;
        }
        if (err instanceof ApiError && err.status === 404) show("Product not found — ask a manager to add this barcode to inventory first.", "error");
        else show("Could not look up barcode. Check scanner connection and try again.", "error");
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
      // If offline, try local IndexedDB
      if (!navigator.onLine || (err instanceof ApiError && err.status === 0)) {
        const local = await findCustomerByPhone(phone);
        if (local) {
          setCustomer(local as unknown as Customer);
          setCustomerName(local.name);
          setDuePaid("");
          show(`${local.name} — ${local.loyaltyPoints} points (offline)`, "success");
          return;
        }
        setCustomer(null);
        show("New customer — will be created when you sync.", "info");
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setCustomer(null);
        show("New customer — will be created automatically when you complete the sale.", "info");
      } else {
        show("Could not look up customer. Check the phone number and try again.", "error");
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
    setSalesmanId(null);
    setPayments([{ method: "CASH", amount: 0 }]);
    setFocusedCartIndex(null);
  };

  const canFinalize = cart.length > 0 || returnLines.length > 0 || dueToClear > 0;

  const finalizeSale = useCallback(async () => {
    if (!canFinalize || isCheckingOut) return;
    setIsCheckingOut(true);
    setShowShutdownDialog(false);

    // Compute totals for offline fallback
    const computedTotal = round2(
      quote.total - returnTotal - creditUse +
      (duePaidFinal < dueToClear ? dueToClear : 0)
    );
    const computedGrandTotal = Math.max(0, computedTotal);

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

      const invoicePayload = {
        customerName,
        customerPhone,
        salesmanId: salesmanId || null,
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, rateTier: item.rateTier, discountType: item.discountType, discountValue: item.discountValue })),
        discountType,
        discountValue: Number(discountValue) || 0,
        pointsRedeemed: Number(pointsRedeemed) || 0,
        payments: payments.filter((p) => p.amount > 0),
        duePaid: dueToClear,
        returns: returnsPayload,
        refundMode,
        creditApplied: creditUse,
      };

      const invoice = await api.post<Invoice>("/invoices", invoicePayload);

      // Check if this was an offline/queued response
      const isOfflineSale = (invoice as unknown as { offline?: boolean }).offline;

      if (isOfflineSale) {
        // Generate local invoice number
        const localInvoiceNumber = `OFF-${Date.now()}`;
        const localId = Date.now();

        // Save to local IndexedDB
        await saveOfflineInvoice({
          id: localId,
          invoiceNumber: localInvoiceNumber,
          customerName,
          customerPhone,
          salesmanId: salesmanId || null,
          totalAmount: computedGrandTotal,
          discountAmount: quote.discountAmount,
          taxAmount: quote.taxAmount,
          loyaltyDiscount: quote.loyaltyDiscount,
          refundValue: refundValue,
          previousDuePaid: dueToClear,
          createdAt: new Date().toISOString(),
          synced: false,
        });

        // Deduct stock locally
        for (const item of cart) {
          await updateProductStock(item.product.id, -item.quantity);
        }

        show(`Sale saved offline (${localInvoiceNumber}) — will sync when connected`, "success");
        setCompletedSale({
          id: localId,
          invoiceNumber: localInvoiceNumber,
          totalAmount: computedGrandTotal,
          changeDue,
          payments: payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount })),
        });
        // Auto-print offline receipt if enabled
        if (shop?.autoPrintReceipt) {
          setTimeout(() => {
            printOfflineReceipt({
              invoiceNumber: localInvoiceNumber,
              customerName: customerName || "Walk-in",
              cart,
              totalAmount: computedGrandTotal,
              discountAmount: quote.discountAmount,
              taxAmount: quote.taxAmount,
              loyaltyDiscount: quote.loyaltyDiscount,
              payments: payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount })),
              changeDue,
              currencySymbol: sym,
              shopName: shop?.shopName,
              shopAddress: shop?.address1 || undefined,
              shopCity: shop?.city || undefined,
              shopPhone: shop?.phone || undefined,
              gstin: shop?.gstNumber || undefined,
            });
          }, 0);
        }
      } else {
        // Normal online sale
        const parts = [`${invoice.invoiceNumber} \u00b7 ${money(invoice.totalAmount)}`];
        if (invoice.previousDuePaid > 0) parts.push(`${money(invoice.previousDuePaid)} due cleared`);
        if (invoice.refundValue > 0)
          parts.push(`${money(invoice.refundValue)} refunded (${invoice.refundMode === "CREDIT" ? "store credit" : "cash"})`);
        if (invoice.discountAmount > 0) parts.push(`${money(invoice.discountAmount)} discount applied`);
        show(`Done \u2014 ${parts.join(" \u00b7 ")}`, "success");
        setCompletedSale({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          changeDue: invoice.changeDue,
          payments: payments.filter((p) => p.amount > 0).map((p) => ({ method: p.method, amount: p.amount })),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      resetSale();

      // Clear draft after successful checkout
      try { if (draftDbIdRef.current) await deleteDraft(draftDbIdRef.current); } catch {}
      try { if (draftDbIdRef.current) await deleteDraftLocal(draftDbIdRef.current); } catch {}
      draftDbIdRef.current = null;

      if (!isOfflineSale && shop?.autoPrintReceipt) {
        if (shop.autoPrintMethod === "usb") {
          api.post(`/print/${invoice.id}/usb`).catch((err) =>
            show(describeApiError(err, "Auto-print to USB printer failed"), "error")
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

  function setCartRateTier(productId: number, rateTier: "A" | "B" | "C" | null) {
    setCart((prev) => {
      const item = prev.find(i => i.product.id === productId);
      if (item && rateTier) {
        const ep = effectivePrice(item.product, rateTier);
        if (item.product.purchasePrice > 0 && ep < item.product.purchasePrice) {
          show(`LOSS: "${item.product.name}" at ${money(ep)} is below cost ${money(item.product.purchasePrice)}`, "error");
        }
      }
      return prev.map((i) => i.product.id === productId ? { ...i, rateTier } : i);
    });
  }

  function setCartItemDiscount(productId: number, discountType: "percent" | "amount" | null, discountValue: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, discountType, discountValue } : item
      )
    );
  }

  function holdBill() {
    if (cart.length === 0) return show("Cart is empty — nothing to hold", "error");
    const held = {
      id: `held_${Date.now()}`,
      cart: [...cart],
      customerName,
      customerPhone,
      discountType,
      discountValue,
      timestamp: Date.now(),
    };
    setHeldBills((prev) => {
      const updated = [...prev, held];
      try { localStorage.setItem("ssmart-held-bills", JSON.stringify(updated)); } catch {}
      return updated;
    });
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomer(null);
    setDiscountType(null);
    setDiscountValue(0);
    setPointsRedeemed(0);
    setPayments([{ method: "CASH", amount: 0 }]);
    show(`Bill held (${cart.length} items) — press Recall to get it back`, "info");
  }

  function recallBill(heldId: string) {
    const held = heldBills.find((b) => b.id === heldId);
    if (!held) return;
    setCart(held.cart);
    setCustomerName(held.customerName);
    setCustomerPhone(held.customerPhone);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    setHeldBills((prev) => {
      const updated = prev.filter((b) => b.id !== heldId);
      try { localStorage.setItem("ssmart-held-bills", JSON.stringify(updated)); } catch {}
      return updated;
    });
    setShowHeldBills(false);
    show(`Bill recalled (${held.cart.length} items)`, "info");
  }

  const maxRedeemable = customer && shop?.loyaltyEnabled ? customer.loyaltyPoints : 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.key === "F5") { e.preventDefault(); resetSale(); show("Cart cleared", "info"); }
      if (e.key === "F1") { e.preventDefault(); setShowHelpDialog(true); }
      if (e.key === "F6") { e.preventDefault(); const phone = posRef.current?.querySelector('input[placeholder*="Phone"]') as HTMLElement | null; if (phone) phone.focus(); }
      if (e.key === "F7") { e.preventDefault(); const disc = posRef.current?.querySelector('select[aria-label="Discount type"]') as HTMLElement | null; if (disc) disc.focus(); }
      if (e.key === "F12" || e.key === "End") { e.preventDefault(); if (canFinalize) setShowConfirmDialog(true); }
      if (e.key === "Escape") { e.preventDefault(); setCompletedSale(null); setShowShutdownDialog(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === " ") { e.preventDefault(); const search = posRef.current?.querySelector('input[placeholder*="Scan or type"]') as HTMLElement | null; if (search) search.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [finalizeSale, resetSale, show]);

  return (
    <div ref={posRef} className="flex flex-col gap-4 h-full">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2">
          <WifiOff className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium text-warning">You are offline — sales will be saved locally and sync when connected</span>
        </div>
      )}

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
            onClick={holdBill}
            disabled={cart.length === 0}
            className="btn-touch flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40"
            title="Hold current bill and start a new one"
          >
            Hold Bill
          </button>
          <button
            type="button"
            onClick={() => setShowHeldBills(true)}
            disabled={heldBills.length === 0}
            className="btn-touch flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40"
            title="Recall a held bill"
          >
            Recall ({heldBills.length})
          </button>
          <button
            type="button"
            onClick={() => setShowShutdownDialog(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-brand/10 hover:text-brand transition-colors"
            aria-label="Shutdown"
            title="End session & backup (Ctrl+Q)"
          >
            <Power className="h-5 w-5" />
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

      {showHeldBills && (
        <Card className="p-6 max-w-lg mx-auto animate-scale-in">
          <h2 className="text-lg font-bold text-foreground mb-2">Recall Held Bill</h2>
          <p className="text-sm text-text-secondary mb-4">Select a held bill to load it back into the cart.</p>
          {heldBills.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground/50">No held bills</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-auto">
              {heldBills.map((held) => {
                const itemCount = held.cart.reduce((s, c) => s + c.quantity, 0);
                const total = held.cart.reduce((s, c) => s + effectivePrice(c.product, c.rateTier) * c.quantity, 0);
                return (
                  <button
                    key={held.id}
                    type="button"
                    onClick={() => recallBill(held.id)}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-surface-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {held.customerName || "Walk-in"} · {itemCount} items
                      </p>
                      <p className="text-xs text-foreground/50">
                        {new Date(held.timestamp).toLocaleTimeString()} · {money(total)}
                      </p>
                    </div>
                    <span className="text-xs text-brand font-medium">Load</span>
                  </button>
                );
              })}
            </div>
          )}
          <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setShowHeldBills(false)}>Cancel</Button>
        </Card>
      )}

      <BillConfirmDialog
        open={showConfirmDialog}
        total={collectTotal}
        paymentMethods={payments}
        onPaymentMethodsChange={setPayments}
        onConfirm={() => { setShowConfirmDialog(false); finalizeSale(); }}
        onCancel={() => setShowConfirmDialog(false)}
        isProcessing={isCheckingOut}
        currencySymbol={sym}
      />

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

      {showHelpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowHelpDialog(false)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light">
                <HelpCircle className="h-5 w-5 text-brand" />
              </div>
              <h2 className="text-lg font-bold text-foreground">How to use POS</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm text-foreground/80 max-h-[60vh] overflow-y-auto">
              <Section title="Quick Sale">
                <li>Scan a barcode or type a product name in the search box</li>
                <li>Product is added to cart with quantity 1 — click qty to change</li>
                <li>Press <Key>F12</Key> or <Key>End</Key> to open the checkout popup</li>
                <li>Select payment method (Cash / UPI / Card), enter amount, confirm</li>
              </Section>
              <Section title="Customer & Loyalty">
                <li>Press <Key>F6</Key> to jump to the customer phone field</li>
                <li>Type a phone number and press the search icon to look up the customer</li>
                <li>Loyalty points are earned automatically (10 points per ₹100)</li>
                <li>Redeem points by entering a value — 1 point = ₹0.10 off</li>
              </Section>
              <Section title="Discount">
                <li>Press <Key>F7</Key> to jump to the discount dropdown</li>
                <li>Select <strong>%</strong> for percentage discount or <strong>₹</strong> for flat amount</li>
                <li>Enter the discount value — it applies to the whole bill</li>
              </Section>
              <Section title="Split Payment">
                <li>Click <strong>+ Split payment</strong> to add multiple payment methods</li>
                <li>Example: ₹500 Cash + ₹200 UPI for a ₹700 bill</li>
                <li>The system shows remaining amount and change due in real time</li>
              </Section>
              <Section title="Return / Exchange">
                <li>In the Return section, type an invoice number and press search</li>
                <li>Select items to return and enter quantities</li>
                <li>Choose refund method: Cash, UPI, or store credit</li>
                <li>Returns can be combined with a new sale in the same transaction</li>
              </Section>
              <Section title="Keyboard Shortcuts">
                <li><Key>F1</Key> Show this help</li>
                <li><Key>F5</Key> Clear cart / start new sale</li>
                <li><Key>F6</Key> Focus customer phone field</li>
                <li><Key>F7</Key> Focus discount field</li>
                <li><Key>F12</Key> / <Key>End</Key> Open checkout</li>
                <li><Key>Ctrl+Space</Key> Focus search bar</li>
                <li><Key>Esc</Key> Close popups</li>
              </Section>
            </div>
            <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setShowHelpDialog(false)}>Got it</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] flex-1 overflow-hidden">
        {/* Cart */}
        <Card className="p-4 flex flex-col overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Billing</h2>
            <span className="text-xs text-text-tertiary">Scan barcode or search to add items</span>
          </div>

          <ProductSearch onAddToCart={addToCart} />

          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-brand mb-4">
                <ScanBarcode className="h-8 w-8" />
              </div>
              <p className="text-base font-medium text-foreground">No items in bill</p>
              <p className="text-sm text-text-tertiary mt-1">Use the search bar above to add products</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-text-tertiary">
                    <th className="pb-2 pr-2 font-semibold">#</th>
                    <th className="pb-2 pr-2 font-semibold">Item Name</th>
                    <th className="pb-2 pr-2 text-right font-semibold">MRP</th>
                    <th className="pb-2 pr-2 font-semibold">Price</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Qty</th>
                    <th className="pb-2 pr-2 font-semibold">Disc</th>
                    {shop?.gstEnabled && <th className="pb-2 pr-2 text-right font-semibold">GST%</th>}
                    <th className="pb-2 pr-2 text-right font-semibold">Amount</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {cart.map((item, idx) => (
                    <tr
                      key={item.product.id}
                      className={`transition-colors hover:bg-surface-muted/50 ${focusedCartIndex === idx ? "bg-brand/5" : ""}`}
                      onClick={() => setFocusedCartIndex(idx)}
                    >
                      <td className="py-2 pr-2 text-xs text-foreground/40">{idx + 1}</td>
                      <td className="py-2 pr-2 font-medium text-foreground max-w-[200px] truncate">
                        {item.product.name}
                        {item.product.unit && <span className="ml-1.5 font-normal text-foreground/40">({item.product.unit})</span>}
                      </td>
                      <td className="py-2 pr-2 text-right text-foreground/50 text-xs">
                        {(item.product.mrp || item.product.sellingPrice) > effectivePrice(item.product, item.rateTier) ? (
                          <span className="line-through">{money(item.product.mrp || item.product.sellingPrice)}</span>
                        ) : (
                          money(item.product.mrp || item.product.sellingPrice)
                        )}
                      </td>
                      <td className="py-2 pr-1">
                        <select
                          value={item.rateTier || ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setCartRateTier(item.product.id, val as "A" | "B" | "C" | null);
                          }}
                          className="w-20 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground font-medium"
                          title="Select price: MRP, Wholesale, Retail, or Special"
                        >
                          <option value="">MRP</option>
                          {item.product.rateA != null && item.product.rateA > 0 && <option value="A">Wholesale</option>}
                          {item.product.rateB != null && item.product.rateB > 0 && <option value="B">Retail</option>}
                          {item.product.rateC != null && item.product.rateC > 0 && <option value="C">Special</option>}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right font-medium text-foreground">
                        {money(effectivePrice(item.product, item.rateTier))}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center justify-end gap-1">
                          <QuantityPopover
                            product={item.product}
                            quantity={item.quantity}
                            onSetQuantity={(q) => setQuantityDirect(item.product.id, q)}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-1">
                        <div className="flex items-center gap-0.5">
                          <select
                            value={item.discountType || ""}
                            onChange={(e) => {
                              const dt = (e.target.value || null) as "percent" | "amount" | null;
                              setCartItemDiscount(item.product.id, dt, item.discountValue);
                            }}
                            className="h-6 rounded border border-border bg-surface px-0.5 text-[10px] text-foreground"
                            title="Discount type"
                          >
                            <option value="">--</option>
                            <option value="percent">%</option>
                            <option value="amount">{sym}</option>
                          </select>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.discountValue || ""}
                            onChange={(e) => setCartItemDiscount(item.product.id, item.discountType, Number(e.target.value) || 0)}
                            disabled={!item.discountType}
                            className="h-6 w-12 rounded border border-border bg-surface px-1 text-[10px] text-right text-foreground disabled:opacity-40"
                            title="Discount value"
                          />
                        </div>
                      </td>
                      {shop?.gstEnabled && (
                        <td className="py-2 pr-2 text-right text-foreground/50">{item.product.taxRate}%</td>
                      )}
                      <td className="py-2 pr-2 text-right font-semibold text-foreground">
                        {money(round2(effectivePrice(item.product, item.rateTier) * item.quantity * (1 - (item.discountType === "percent" ? (item.discountValue || 0) / 100 : 0)) - (item.discountType === "amount" ? item.discountValue || 0 : 0)))}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Remove ${item.product.name}`}
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-foreground/40 hover:text-danger transition-colors"
                          title="Remove item"
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

          {/* Product Info Panel — shows details of selected item (like MARG) */}
          {focusedCartIndex !== null && cart[focusedCartIndex] && (
            <div className="mt-2 rounded-lg border border-brand/20 bg-brand/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-brand uppercase">Selected Item Details</h3>
                <button type="button" onClick={() => setFocusedCartIndex(null)} className="text-foreground/40 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {(() => {
                const p = cart[focusedCartIndex].product;
                const item = cart[focusedCartIndex];
                const ep = effectivePrice(p, item.rateTier);
                const lineTotal = ep * item.quantity;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <span className="text-foreground/50">Product</span>
                      <p className="font-medium text-foreground truncate">{p.name}</p>
                    </div>
                    <div>
                      <span className="text-foreground/50">Barcode</span>
                      <p className="font-mono text-foreground">{p.barcode || "—"}</p>
                    </div>
                    <div>
                      <span className="text-foreground/50">MRP</span>
                      <p className="font-medium text-foreground">{money(p.mrp || p.sellingPrice)}</p>
                    </div>
                    <div>
                      <span className="text-foreground/50">Our Price</span>
                      <p className="font-medium text-success">{money(ep)}</p>
                    </div>
                    {p.category && (
                      <div>
                        <span className="text-foreground/50">Category</span>
                        <p className="text-foreground">{p.category}</p>
                      </div>
                    )}
                    {p.hsn && (
                      <div>
                        <span className="text-foreground/50">HSN Code</span>
                        <p className="font-mono text-foreground">{p.hsn}</p>
                      </div>
                    )}
                    {shop?.gstEnabled && (
                      <div>
                        <span className="text-foreground/50">GST Rate</span>
                        <p className="text-foreground">{p.taxRate}%</p>
                      </div>
                    )}
                    <div>
                      <span className="text-foreground/50">Stock</span>
                      <p className={`font-medium ${p.stock <= 0 ? "text-danger" : p.stock <= 5 ? "text-warning" : "text-foreground"}`}>
                        {p.stock} {p.unit || "units"}
                      </p>
                    </div>
                    <div>
                      <span className="text-foreground/50">Cost Price</span>
                      <p className="text-foreground">{money(p.purchasePrice)}</p>
                      {p.purchasePrice > 0 && ep > p.purchasePrice && (
                        <p className="text-[10px] text-success">Margin: {((ep - p.purchasePrice) / ep * 100).toFixed(1)}%</p>
                      )}
                      {p.purchasePrice > 0 && ep < p.purchasePrice && (
                        <p className="text-[10px] text-danger">LOSS: -{((p.purchasePrice - ep) / p.purchasePrice * 100).toFixed(1)}%</p>
                      )}
                    </div>
                    <div>
                      <span className="text-foreground/50">Quantity</span>
                      <p className="font-medium text-foreground">{item.quantity}</p>
                    </div>
                    <div>
                      <span className="text-foreground/50">Line Total</span>
                      <p className="font-bold text-foreground">{money(lineTotal)}</p>
                    </div>
                    {p.discountType && p.discountValue > 0 && (
                      <div>
                        <span className="text-foreground/50">Standing Discount</span>
                        <p className="text-success">
                          {p.discountType === "percent" ? `${p.discountValue}% off` : `${money(p.discountValue)} off`}
                        </p>
                      </div>
                    )}
                    {p.unit && (
                      <div>
                        <span className="text-foreground/50">Unit</span>
                        <p className="text-foreground">{p.unit}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Last 4 Deals — shows recent sale rates for the selected product */}
          {focusedCartIndex !== null && cart[focusedCartIndex] && (
            <LastDeals productId={cart[focusedCartIndex].product.id} sym={sym} />
          )}

          {/* Bill Summary Bar — always visible when cart has items */}
          {cart.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-surface-muted/50 p-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="text-foreground/60">Items: <strong className="text-foreground">{cart.reduce((s, c) => s + c.quantity, 0)}</strong></span>
                <span className="text-foreground/60">Subtotal: <strong className="text-foreground">{money(quote.subtotal)}</strong></span>
                {quote.discountAmount > 0 && (
                  <span className="text-success">Discount: <strong>-{money(quote.discountAmount)}</strong></span>
                )}
                {shop?.gstEnabled && quote.taxAmount > 0 && (
                  <span className="text-foreground/60">GST (incl.): <strong className="text-foreground">{money(quote.taxAmount)}</strong></span>
                )}
                {quote.loyaltyDiscount > 0 && (
                  <span className="text-success">Loyalty: <strong>-{money(quote.loyaltyDiscount)}</strong></span>
                )}
                {returnTotal > 0 && (
                  <span className="text-success">Returns: <strong>-{money(returnTotal)}</strong></span>
                )}
                {creditUse > 0 && (
                  <span className="text-success">Credit: <strong>-{money(creditUse)}</strong></span>
                )}
                <span className="ml-auto text-base font-bold text-brand">Total: {money(collectTotal)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Checkout panel */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {/* Customer */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Customer</h2>
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

          {/* Salesman */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Salesman</h2>
            <select
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
              value={salesmanId ?? ""}
              onChange={(e) => setSalesmanId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No salesman</option>
              {salesmen.filter(s => s.active).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </Card>

          {/* Returns / exchange */}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-base font-semibold text-foreground">Return / Exchange</h2>
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
            <h2 className="text-base font-semibold text-foreground">Bill Discount</h2>
            <div className="flex gap-2">
              <select aria-label="Discount type" value={discountType ?? ""} onChange={(e) => setDiscountType((e.target.value || null) as "percent" | "amount" | null)} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground">
                <option value="">None</option>
                <option value="percent">%</option>
                <option value="amount">{sym}</option>
              </select>
              <input type="number" min={0} step="0.01" disabled={!discountType} value={discountValue || ""} onChange={(e) => setDiscountValue(Number(e.target.value) || 0)} placeholder="Discount value" aria-label="Discount value" className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground disabled:opacity-50" />
            </div>

            <h2 className="mt-2 text-base font-semibold text-foreground">Payment Method</h2>
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
                  <Row label="Subtotal (MRP)" value={money(quote.subtotal)} />
                  {quote.discountAmount > 0 && <Row label="Bill Discount" value={`- ${money(quote.discountAmount)}`} />}
                  {shop?.gstEnabled && quote.taxAmount > 0 && <Row label="GST (included in price)" value={money(quote.taxAmount)} />}
                  {quote.loyaltyDiscount > 0 && <Row label="Loyalty Points Used" value={`- ${money(quote.loyaltyDiscount)}`} />}
                  {returnTotal > 0 && <Row label="Returns" value={`- ${money(returnTotal)}`} />}
                  {creditUse > 0 && <Row label="Store Credit Used" value={`- ${money(creditUse)}`} />}
                  {dueToClear > 0 && (
                    <Row label={duePaidFinal < dueToClear ? "Previous Due (part)" : "Previous Due Cleared"} value={money(duePaidFinal)} />
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
                <span className="text-sm font-semibold text-brand">{returnTotal > 0 || creditUse > 0 || dueToClear > 0 ? "Amount to Collect" : "Grand Total"}</span>
                <span className="text-2xl font-bold text-brand">{money(collectTotal)}</span>
              </div>
            )}
            {changeDue > 0 && (<Row label="Return Change" value={money(changeDue)} />)}
            {shortNow > 0 && (<p className={`rounded-lg px-3 py-2 text-xs font-medium ${customer ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>{customer ? `${money(shortNow)} short — unpaid part stays on ${customer.name}'s due` : `${money(shortNow)} short — add a customer to record as due`}</p>)}
            {shop?.loyaltyEnabled && customer && quote.pointsEarned > 0 && (<p className="text-xs text-foreground/50">Earns {quote.pointsEarned} loyalty points</p>)}
            <Button onClick={() => setShowConfirmDialog(true)} disabled={!canFinalize || isCheckingOut} className="btn-touch mt-2 w-full" size="lg">
              {isCheckingOut ? "Processing..." : "COMPLETE SALE"}
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

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-block rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] font-mono font-semibold text-foreground/70">{children}</kbd>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">{title}</p>
      <ul className="list-disc list-inside space-y-0.5 text-[13px] text-foreground/70">{children}</ul>
    </div>
  );
}

function LastDeals({ productId, sym }: { productId: number; sym: string }) {
  const { data: deals = [] } = useQuery<{ rate: number; discountType: string | null; discountValue: number; quantity: number; date: string; invoiceNumber: string; customerName: string }[]>({
    queryKey: ["last-deals", productId],
    queryFn: () => api.get(`/products/${productId}/last-deals?limit=4`),
    staleTime: 30_000,
  });
  if (deals.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-border bg-surface-muted p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/50 mb-2">Last Sale Rates</h3>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {deals.map((d, i) => (
          <div key={i} className="rounded bg-surface p-2 text-center">
            <p className="font-bold text-foreground">{sym}{d.rate.toFixed(2)}</p>
            <p className="text-foreground/50 mt-0.5">Qty: {d.quantity}</p>
            <p className="text-foreground/40 text-[10px] truncate" title={d.customerName}>{d.customerName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}