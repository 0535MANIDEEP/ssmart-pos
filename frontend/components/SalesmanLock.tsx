'use client';

import { useState } from 'react';
import { User, X, Check } from 'lucide-react';

interface SalesmanLockProps {
  isOpen: boolean;
  salesmen: Array<{ id: string; name: string }>;
  onUnlock: (salesman: { id: string; name: string }) => void;
  onClose: () => void;
}

export default function SalesmanLock({
  isOpen,
  salesmen,
  onUnlock,
  onClose,
}: SalesmanLockProps) {
  const [selectedId, setSelectedId] = useState('');

  if (!isOpen) return null;

  const selected = salesmen.find((s) => s.id === selectedId);

  const handleConfirm = () => {
    if (!selected) return;
    onUnlock(selected);
    setSelectedId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Select Salesman</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Salesman Grid */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {salesmen.length === 0 ? (
            <p className="col-span-2 text-center text-sm text-gray-500 py-4">
              No salesmen configured
            </p>
          ) : (
            salesmen.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition ${
                  selectedId === s.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium">{s.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="mr-1 inline h-4 w-4" />
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
