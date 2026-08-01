// frontend/lib/capacitor-platform.ts
// ==========================================
// SS Mart — Platform detection helper
// ==========================================

import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'ios' | 'android' | 'desktop';

export function getPlatform(): Platform {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as 'ios' | 'android';
  }
  if (typeof window !== 'undefined' && window.__TAURI__) {
    return 'desktop';
  }
  return 'web';
}

export function isMobile(): boolean {
  const p = getPlatform();
  return p === 'ios' || p === 'android';
}

export function isDesktop(): boolean {
  return getPlatform() === 'desktop';
}

export function isWeb(): boolean {
  return getPlatform() === 'web';
}

// Check if we're running inside Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
