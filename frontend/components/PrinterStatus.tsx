// frontend/components/PrinterStatus.tsx
// ==========================================
// SS Mart — Printer Connection Status Component
// Shows in POS screen header
// ==========================================
'use client';

import { useState } from 'react';
import { useThermalPrinter } from '@/hooks/useThermalPrinter';
import { getCurrentDevice } from '@/lib/thermal-printer';
import {
  Printer,
  PrinterCheck,
  Unplug,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

export default function PrinterStatus() {
  const { status, supported, error, connect, disconnect, reconnect } =
    useThermalPrinter();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!supported) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        <span>No Web Serial</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
          status === 'connected'
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : status === 'connecting'
            ? 'bg-yellow-100 text-yellow-800'
            : status === 'error'
            ? 'bg-red-100 text-red-800 hover:bg-red-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {status === 'connected' ? (
          <PrinterCheck className="h-3.5 w-3.5" />
        ) : status === 'connecting' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === 'error' ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        <span>
          {status === 'connected'
            ? 'Printer Connected'
            : status === 'connecting'
            ? 'Connecting...'
            : status === 'error'
            ? 'Printer Error'
            : 'Printer Disconnected'}
        </span>
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border bg-white p-2 shadow-lg">
            {status === 'connected' ? (
              <>
                <div className="mb-2 flex items-center gap-2 rounded bg-green-50 p-2 text-xs text-green-700">
                  <PrinterCheck className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Connected</p>
                    <p className="text-green-600">
                      Baud: {getCurrentDevice()?.baudRate || '—'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    disconnect();
                    setShowDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </button>
              </>
            ) : (
              <>
                {error && (
                  <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
                <button
                  onClick={() => {
                    connect();
                    setShowDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <Wifi className="h-4 w-4" />
                  Connect Printer
                </button>
                {status === 'error' && (
                  <button
                    onClick={() => {
                      reconnect();
                      setShowDropdown(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <Loader2 className="h-4 w-4" />
                    Reconnect
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
