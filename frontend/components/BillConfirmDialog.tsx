"use client";

import { useState } from "react";
import { X, Banknote, Smartphone, CreditCard, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

interface BillConfirmDialogProps {
  open: boolean;
  total: number;
  paymentMethods: { method: PaymentMethod; amount: number }[];
  onPaymentMethodsChange: (methods: { method: PaymentMethod; amount: number }[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
  currencySymbol?: string;
}

const METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  CASH: Banknote,
  UPI: Smartphone,
  CARD: CreditCard,
};

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH: "text-success",
  UPI: "text-brand",
  CARD: "text-warning",
};

export function BillConfirmDialog({
  open,
  total,
  paymentMethods,
  onPaymentMethodsChange,
  onConfirm,
  onCancel,
  isProcessing,
  currencySymbol = "₹",
}: BillConfirmDialogProps) {
  const [activeInput, setActiveInput] = useState<number>(0);

  const totalTendered = paymentMethods.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - totalTendered);
  const changeDue = Math.max(0, totalTendered - total);

  function updateAmount(idx: number, value: number) {
    const updated = paymentMethods.map((p, i) => (i === idx ? { ...p, amount: value } : p));
    onPaymentMethodsChange(updated);
  }

  function updateMethod(idx: number, method: PaymentMethod) {
    const updated = paymentMethods.map((p, i) => (i === idx ? { ...p, method } : p));
    onPaymentMethodsChange(updated);
  }

  function addPaymentLine() {
    const nextMethod: PaymentMethod = paymentMethods.length > 0 && paymentMethods[paymentMethods.length - 1].method === "CASH" ? "UPI" : "CASH";
    onPaymentMethodsChange([...paymentMethods, { method: nextMethod, amount: remaining > 0 ? remaining : 0 }]);
    setActiveInput(paymentMethods.length);
  }

  function removePaymentLine(idx: number) {
    if (paymentMethods.length <= 1) return;
    onPaymentMethodsChange(paymentMethods.filter((_, i) => i !== idx));
    setActiveInput(Math.max(0, idx - 1));
  }

  function setExactAmount(idx: number) {
    updateAmount(idx, total - paymentMethods.filter((_, i) => i !== idx).reduce((s, p) => s + p.amount, 0));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Complete Sale</h2>
            <p className="text-sm text-text-secondary">Confirm payment and finish the bill</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-text-tertiary hover:bg-surface-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Total Amount */}
        <div className="border-b border-border bg-surface-muted px-6 py-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Total Amount</p>
          <p className="text-3xl font-bold text-foreground">{formatMoney(total, currencySymbol)}</p>
        </div>

        {/* Payment Lines */}
        <div className="px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Payment</p>
            {remaining > 0 && (
              <button
                onClick={addPaymentLine}
                className="text-xs font-medium text-brand hover:underline"
              >
                + Split payment
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {paymentMethods.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {/* Method selector */}
                <div className="flex gap-1">
                  {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((m) => {
                    const Icon = METHOD_ICONS[m];
                    return (
                      <button
                        key={m}
                        onClick={() => updateMethod(idx, m)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                          line.method === m
                            ? "border-brand bg-brand-light text-brand"
                            : "border-border text-text-tertiary hover:border-brand/30"
                        }`}
                        title={m}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>

                {/* Amount input */}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">{currencySymbol}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.amount || ""}
                    onChange={(e) => updateAmount(idx, Number(e.target.value) || 0)}
                    onFocus={() => setActiveInput(idx)}
                    placeholder="0.00"
                    autoFocus={activeInput === idx}
                    className="h-10 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-right text-lg font-semibold text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setExactAmount(idx)}
                    className="h-10 rounded-lg border border-border px-2 text-[10px] font-medium text-text-secondary hover:bg-surface-muted"
                    title="Set exact remaining"
                  >
                    EXACT
                  </button>
                  {paymentMethods.length > 1 && (
                    <button
                      onClick={() => removePaymentLine(idx)}
                      className="h-10 rounded-lg border border-border px-2 text-text-tertiary hover:bg-danger-light hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Total tendered</span>
              <span className="font-medium text-foreground">{formatMoney(totalTendered, currencySymbol)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Remaining</span>
                <span className="font-medium text-warning">{formatMoney(remaining, currencySymbol)}</span>
              </div>
            )}
            {changeDue > 0 && (
              <div className="mt-2 rounded-lg border-2 border-success/30 bg-success-light p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-success mb-1">Return Change</p>
                <p className="text-2xl font-bold text-success">{formatMoney(changeDue, currencySymbol)}</p>
                <p className="text-[11px] text-success/70 mt-0.5">Count and return this amount to customer</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <Button variant="secondary" onClick={onCancel} disabled={isProcessing} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing || totalTendered < total} className="flex-1">
            {isProcessing ? (
              "Processing..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Complete Sale
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
