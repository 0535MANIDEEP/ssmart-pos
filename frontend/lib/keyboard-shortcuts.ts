// frontend/lib/keyboard-shortcuts.ts
// ==========================================
// SS Mart — Global Keyboard Shortcuts
// MARG-style keyboard navigation
// ==========================================

export interface Shortcut {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'navigation' | 'billing' | 'inventory' | 'reports' | 'system';
}

export const SHORTCUTS: Shortcut[] = [
  // Navigation
  { id: 'pos', key: 'F1', description: 'POS / New Sale', category: 'navigation' },
  { id: 'dashboard', key: 'F2', description: 'Dashboard', category: 'navigation' },
  { id: 'products', key: 'F3', description: 'Products', category: 'navigation' },
  { id: 'customers', key: 'F4', description: 'Customers', category: 'navigation' },
  { id: 'invoices', key: 'F5', description: 'Invoices', category: 'navigation' },
  { id: 'reports', key: 'F6', description: 'Reports', category: 'navigation' },
  { id: 'settings', key: 'F7', description: 'Settings', category: 'navigation' },
  { id: 'cashdrawer', key: 'F8', description: 'Cash Drawer', category: 'navigation' },
  { id: 'purchases', key: 'F9', description: 'Purchases', category: 'navigation' },
  { id: 'suppliers', key: 'F10', description: 'Suppliers', category: 'navigation' },

  // Billing
  { id: 'holdbill', key: 'F11', description: 'Hold Current Bill', category: 'billing' },
  { id: 'recallbill', key: 'F12', description: 'Recall Held Bill', category: 'billing' },
  { id: 'payment', key: 'Enter', ctrl: true, description: 'Open Payment', category: 'billing' },
  { id: 'clearbill', key: 'Escape', description: 'Clear / Cancel', category: 'billing' },
  { id: 'search', key: '/', description: 'Search Products', category: 'billing' },
  { id: 'quantity', key: 'q', description: 'Set Quantity', category: 'billing' },
  { id: 'discount', key: 'd', description: 'Apply Discount', category: 'billing' },
  { id: 'removeitem', key: 'Delete', description: 'Remove Selected Item', category: 'billing' },
  { id: 'pricecheck', key: 'p', description: 'Price Check', category: 'billing' },

  // System
  { id: 'printer', key: 'F12', shift: true, description: 'Connect Printer', category: 'system' },
  { id: 'drawer', key: 'F12', ctrl: true, description: 'Open Cash Drawer', category: 'system' },
  { id: 'help', key: '?', description: 'Show Shortcuts', category: 'system' },
  { id: 'fullscreen', key: 'F11', alt: true, description: 'Toggle Fullscreen', category: 'system' },
];

// Check if a shortcut matches a keyboard event
export function matchShortcut(
  event: KeyboardEvent,
  shortcut: Shortcut
): boolean {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  // Function keys are case-sensitive
  if (shortcut.key.startsWith('F') && /^\d+$/.test(shortcut.key.slice(1))) {
    if (event.key !== shortcut.key) return false;
  } else {
    if (key !== shortcutKey && event.key !== shortcut.key) return false;
  }

  if (shortcut.ctrl && !event.ctrlKey && !event.metaKey) return false;
  if (shortcut.shift && !event.shiftKey) return false;
  if (shortcut.alt && !event.altKey) return false;

  // If shortcut doesn't require modifiers, ensure they aren't pressed
  if (!shortcut.ctrl && (event.ctrlKey || event.metaKey)) return false;
  if (!shortcut.shift && event.shiftKey) return false;
  if (!shortcut.alt && event.altKey) return false;

  return true;
}

// Find matching shortcut from event
export function findShortcut(event: KeyboardEvent): Shortcut | null {
  // Ignore if typing in an input/textarea
  const target = event.target as HTMLElement;
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  ) {
    // Allow Escape and function keys in inputs
    if (!event.key.startsWith('F') && event.key !== 'Escape') {
      return null;
    }
  }

  return SHORTCUTS.find((s) => matchShortcut(event, s)) || null;
}

// Get shortcuts for a category
export function getShortcutsByCategory(
  category: Shortcut['category']
): Shortcut[] {
  return SHORTCUTS.filter((s) => s.category === category);
}

// Format shortcut for display
export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  parts.push(shortcut.key);
  return parts.join('+');
}
