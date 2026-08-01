// frontend/components/KeyboardShortcutsHelp.tsx
// ==========================================
// SS Mart — Keyboard Shortcuts Help Dialog
// ==========================================
'use client';

import { SHORTCUTS, formatShortcut, getShortcutsByCategory } from '@/lib/keyboard-shortcuts';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const categories = [
    { key: 'navigation' as const, label: 'Navigation' },
    { key: 'billing' as const, label: 'Billing' },
    { key: 'reports' as const, label: 'Reports' },
    { key: 'inventory' as const, label: 'Inventory' },
    { key: 'system' as const, label: 'System' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {categories.map((cat) => {
            const shortcuts = getShortcutsByCategory(cat.key);
            if (shortcuts.length === 0) return null;

            return (
              <div key={cat.key}>
                <h3 className="mb-2 text-sm font-semibold text-gray-500 uppercase">
                  {cat.label}
                </h3>
                <div className="space-y-1">
                  {shortcuts.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-700">{s.description}</span>
                      <kbd className="rounded border bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                        {formatShortcut(s)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
