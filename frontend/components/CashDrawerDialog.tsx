'use client';

import { useState } from 'react';
import {
  openDrawer,
  closeDrawer,
  isDrawerOpen,
  getDailySummary,
  recordExpense,
  type DailyCashSummary,
} from '@/lib/cash-drawer';
import { IndianRupee, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, Receipt } from 'lucide-react';

interface CashDrawerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CashDrawerDialog({
  isOpen,
  onClose,
  onUpdate,
}: CashDrawerDialogProps) {
  const [tab, setTab] = useState<'open' | 'close' | 'expense'>('open');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const isOpenDrawer = isDrawerOpen();
  const summary = getDailySummary();

  if (!isOpen) return null;

  const handleOpen = () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) {
      setError('Enter a valid opening balance');
      return;
    }
    openDrawer(value);
    setAmount('');
    setError('');
    onUpdate();
    onClose();
  };

  const handleClose = () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) {
      setError('Enter a valid closing balance');
      return;
    }
    closeDrawer(value);
    setAmount('');
    setError('');
    onUpdate();
    onClose();
  };

  const handleExpense = () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      setError('Enter a valid expense amount');
      return;
    }
    recordExpense(value);
    setAmount('');
    setNote('');
    setError('');
    onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Cash Drawer</h2>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('open')}
            disabled={isOpenDrawer}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === 'open'
                ? 'bg-white text-green-700 shadow'
                : isOpenDrawer
                ? 'text-gray-400'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Unlock className="mr-1 inline h-4 w-4" />
            Open
          </button>
          <button
            onClick={() => setTab('close')}
            disabled={!isOpenDrawer}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === 'close'
                ? 'bg-white text-red-700 shadow'
                : !isOpenDrawer
                ? 'text-gray-400'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Lock className="mr-1 inline h-4 w-4" />
            Close
          </button>
          <button
            onClick={() => setTab('expense')}
            disabled={!isOpenDrawer}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === 'expense'
                ? 'bg-white text-orange-700 shadow'
                : !isOpenDrawer
                ? 'text-gray-400'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Receipt className="mr-1 inline h-4 w-4" />
            Expense
          </button>
        </div>

        {/* Summary */}
        {isOpenDrawer && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Opening:</span>{' '}
                <span className="font-medium">₹{summary.openingBalance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Current Cash:</span>{' '}
                <span className="font-medium">₹{summary.currentCash.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sales:</span>{' '}
                <span className="font-medium">₹{summary.totalSales.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Returns:</span>{' '}
                <span className="font-medium">₹{summary.totalReturns.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Expenses:</span>{' '}
                <span className="font-medium">₹{summary.totalExpenses.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Bills:</span>{' '}
                <span className="font-medium">{summary.billCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Open Form */}
        {tab === 'open' && !isOpenDrawer && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Opening Cash Balance
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter opening cash amount"
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <button
              onClick={handleOpen}
              className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Unlock className="mr-1 inline h-4 w-4" />
              Open Drawer
            </button>
          </div>
        )}

        {/* Close Form */}
        {tab === 'close' && isOpenDrawer && (
          <div>
            <div className="mb-3 rounded bg-yellow-50 p-2 text-xs text-yellow-700">
              Expected cash: ₹{summary.expectedCash.toFixed(2)}
            </div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Actual Cash in Drawer
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Count cash and enter amount"
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <button
              onClick={handleClose}
              className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Lock className="mr-1 inline h-4 w-4" />
              Close Drawer
            </button>
          </div>
        )}

        {/* Expense Form */}
        {tab === 'expense' && isOpenDrawer && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Expense Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter expense amount"
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
              autoFocus
            />
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Transport, Milk, etc."
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
            />
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <button
              onClick={handleExpense}
              className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <ArrowUpCircle className="mr-1 inline h-4 w-4" />
              Record Expense
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
