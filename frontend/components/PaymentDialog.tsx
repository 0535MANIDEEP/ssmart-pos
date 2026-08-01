'use client';

import { useState, useEffect } from 'react';
import { IndianRupee, CreditCard, Smartphone, Banknote, X, Check } from 'lucide-react';

interface PaymentSplit {
  cash: number;
  card: number;
  upi: number;
  credit: number;
}

interface PaymentDialogProps {
  isOpen: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (payment: PaymentSplit) => void;
}

export default function PaymentDialog({
  isOpen,
  total,
  onClose,
  onConfirm,
}: PaymentDialogProps) {
  const [payment, setPayment] = useState<PaymentSplit>({
    cash: 0,
    card: 0,
    upi: 0,
    credit: 0,
  });
  const [activeMethod, setActiveMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');

  // Auto-fill remaining amount when switching methods
  useEffect(() => {
    if (!isOpen) return;

    const paid = payment.cash + payment.card + payment.upi + payment.credit;
    const remaining = Math.max(0, total - paid);

    if (remaining > 0 && payment[activeMethod] === 0) {
      // Don't auto-fill, let user enter
    }
  }, [isOpen, total, activeMethod]);

  const totalPaid = payment.cash + payment.card + payment.upi + payment.credit;
  const balance = total - totalPaid;
  const isValid = Math.abs(totalPaid - total) < 0.01;

  if (!isOpen) return null;

  const updateAmount = (method: keyof PaymentSplit, value: string) => {
    const num = parseFloat(value) || 0;
    setPayment((prev) => ({ ...prev, [method]: Math.max(0, num) }));
  };

  const fillRemaining = (method: keyof PaymentSplit) => {
    const paid = total - payment[method]; // Exclude current method
    const remaining = Math.max(0, total - (totalPaid - payment[method]));
    setPayment((prev) => ({ ...prev, [method]: remaining }));
    setActiveMethod(method);
  };

  const fillFull = (method: keyof PaymentSplit) => {
    setPayment({
      cash: method === 'cash' ? total : 0,
      card: method === 'card' ? total : 0,
      upi: method === 'upi' ? total : 0,
      credit: method === 'credit' ? total : 0,
    });
    setActiveMethod(method);
  };

  const confirm = () => {
    if (!isValid) return;
    onConfirm(payment);
    setPayment({ cash: 0, card: 0, upi: 0, credit: 0 });
  };

  const methods = [
    { key: 'cash' as const, label: 'Cash', icon: Banknote, color: 'green' },
    { key: 'card' as const, label: 'Card', icon: CreditCard, color: 'blue' },
    { key: 'upi' as const, label: 'UPI', icon: Smartphone, color: 'purple' },
    { key: 'credit' as const, label: 'Credit', icon: IndianRupee, color: 'orange' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Total */}
        <div className="mb-4 rounded-lg bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-3xl font-bold">₹{total.toFixed(2)}</p>
        </div>

        {/* Quick Pay Buttons */}
        <div className="mb-4 flex gap-2">
          {methods.map((m) => (
            <button
              key={m.key}
              onClick={() => fillFull(m.key)}
              className={`flex-1 rounded-lg border-2 p-2 text-center text-xs font-medium transition ${
                activeMethod === m.key && payment[m.key] === total
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <m.icon className="mx-auto mb-1 h-4 w-4" />
              Full {m.label}
            </button>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="mb-4 space-y-3">
          {methods.map((m) => (
            <div
              key={m.key}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                activeMethod === m.key ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <m.icon className="h-5 w-5 text-gray-500" />
              <span className="w-16 text-sm font-medium">{m.label}</span>
              <input
                type="number"
                value={payment[m.key] || ''}
                onChange={(e) => updateAmount(m.key, e.target.value)}
                onFocus={() => setActiveMethod(m.key)}
                placeholder="0.00"
                className="flex-1 rounded border px-3 py-1.5 text-right text-sm"
              />
              {payment[m.key] > 0 && (
                <button
                  onClick={() => updateAmount(m.key, '0')}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Balance */}
        <div className={`mb-4 rounded-lg p-3 text-center ${
          isValid ? 'bg-green-50 text-green-700' :
          balance > 0 ? 'bg-yellow-50 text-yellow-700' :
          'bg-red-50 text-red-700'
        }`}>
          {isValid ? (
            <p className="text-sm font-medium">Payment complete</p>
          ) : balance > 0 ? (
            <p className="text-sm">Remaining: ₹{balance.toFixed(2)}</p>
          ) : (
            <p className="text-sm">Overpaid by ₹{Math.abs(balance).toFixed(2)}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!isValid}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Confirm ₹{total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
