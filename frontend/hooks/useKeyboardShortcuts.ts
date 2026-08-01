'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { findShortcut, type Shortcut } from '@/lib/keyboard-shortcuts';

interface UseKeyboardShortcutsOptions {
  onPayment?: () => void;
  onHoldBill?: () => void;
  onRecallBill?: () => void;
  onClearBill?: () => void;
  onSearch?: () => void;
  onSetQuantity?: () => void;
  onDiscount?: () => void;
  onRemoveItem?: () => void;
  onPriceCheck?: () => void;
  onHelp?: () => void;
  onCashDrawer?: () => void;
  onPrinter?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();

  const handleShortcut = useCallback(
    (event: KeyboardEvent) => {
      const shortcut = findShortcut(event);
      if (!shortcut) return;

      event.preventDefault();
      event.stopPropagation();

      switch (shortcut.id) {
        // Navigation
        case 'pos':
          router.push('/pos');
          break;
        case 'dashboard':
          router.push('/dashboard');
          break;
        case 'products':
          router.push('/products');
          break;
        case 'customers':
          router.push('/customers');
          break;
        case 'invoices':
          router.push('/invoices');
          break;
        case 'reports':
          router.push('/reports');
          break;
        case 'settings':
          router.push('/settings');
          break;
        case 'cashdrawer':
          options.onCashDrawer?.();
          break;
        case 'purchases':
          router.push('/purchases');
          break;
        case 'suppliers':
          router.push('/suppliers');
          break;

        // Billing
        case 'payment':
          options.onPayment?.();
          break;
        case 'holdbill':
          options.onHoldBill?.();
          break;
        case 'recallbill':
          options.onRecallBill?.();
          break;
        case 'clearbill':
          options.onClearBill?.();
          break;
        case 'search':
          options.onSearch?.();
          break;
        case 'quantity':
          options.onSetQuantity?.();
          break;
        case 'discount':
          options.onDiscount?.();
          break;
        case 'removeitem':
          options.onRemoveItem?.();
          break;
        case 'pricecheck':
          options.onPriceCheck?.();
          break;

        // System
        case 'help':
          options.onHelp?.();
          break;
        case 'printer':
          options.onPrinter?.();
          break;
        case 'drawer':
          options.onCashDrawer?.();
          break;
        case 'fullscreen':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
      }
    },
    [router, options]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [handleShortcut]);
}
