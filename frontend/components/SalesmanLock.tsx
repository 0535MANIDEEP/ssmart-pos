'use client';

import { useState } from 'react';
import { Lock, User, X } from 'lucide-react';

interface SalesmanLockProps {
  isOpen: boolean;
  salesmen: Array<{ id: string; name: string; pin: string }>;
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
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  if (!isOpen) return null;

  const selectedSalesman = salesmen.find((s) => s.id === selectedId);

  const handleUnlock = () => {
    if (!selectedSalesman) {
      setError('Select a salesman');
      return;
    }

    if (selectedSalesman.pin !== pin) {
      setAttempts((a) => a + 1);
      if (attempts >= 2) {
        setError('Too many attempts. Wait 30 seconds.');
        setTimeout(() => setAttempts(0), 30000);
        return;
      }
      setError(`Wrong PIN. ${2 - attempts} attempts left.`);
      setPin('');
      return;
    }

    onUnlock({ id: selectedSalesman.id, name: selectedSalesman.name });
    setSelectedId('');
    setPin('');
    setError('');
    setAttempts(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Salesman Login</h2>
        </div>

        {/* Salesman Grid */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {salesmen.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedId(s.id);
                setPin('');
                setError('');
              }}
              className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left transition ${
                selectedId === s.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium">{s.name}</span>
            </button>
          ))}
        </div>

        {/* PIN Input */}
        {selectedId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Enter PIN for {selectedSalesman?.name}
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter 4-digit PIN"
              maxLength={6}
              className="mb-3 w-full rounded-md border px-3 py-2 text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="mb-3 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!selectedId || !pin}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Lock className="mr-1 inline h-4 w-4" />
            Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
