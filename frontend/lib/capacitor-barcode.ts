// @ts-nocheck — Mobile-only, requires Capacitor packages
// frontend/lib/capacitor-barcode.ts
// ==========================================
// SS Mart — Capacitor Barcode Scanner
// Uses native camera on mobile, falls back to web on desktop
// ==========================================

import { Capacitor } from '@capacitor/core';

export type BarcodeScanResult = {
  hasContent: boolean;
  content: string;
  format: string;
};

let BarcodeScanner: any = null;

async function loadScanner() {
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('@capacitor-community/barcode-scanner');
      BarcodeScanner = mod.BarcodeScanner;
    } catch {
      console.warn('BarcodeScanner plugin not available');
    }
  }
}

export async function checkCameraPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  await loadScanner();
  if (!BarcodeScanner) return false;

  const status = await BarcodeScanner.checkPermission({ force: false });
  if (status.granted) return true;

  const request = await BarcodeScanner.requestPermission();
  return request.granted;
}

export async function startBarcodeScan(): Promise<BarcodeScanResult> {
  if (!Capacitor.isNativePlatform()) {
    // Desktop: return empty (web scanner component handles it)
    return { hasContent: false, content: '', format: '' };
  }

  await loadScanner();
  if (!BarcodeScanner) {
    return { hasContent: false, content: '', format: '' };
  }

  try {
    await BarcodeScanner.hideBackground();
    const result = await BarcodeScanner.startScan({
      targetedFormats: [
        'EAN_13',
        'EAN_8',
        'UPC_A',
        'UPC_E',
        'CODE_128',
        'CODE_39',
        'QR_CODE',
      ],
    });

    await BarcodeScanner.showBackground();

    if (result.hasContent) {
      return {
        hasContent: true,
        content: result.content,
        format: result.format,
      };
    }
  } catch (err) {
    await BarcodeScanner.showBackground();
    console.error('Barcode scan error:', err);
  }

  return { hasContent: false, content: '', format: '' };
}

export async function stopBarcodeScan(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await loadScanner();
  if (BarcodeScanner) {
    await BarcodeScanner.stopScan();
    await BarcodeScanner.showBackground();
  }
}
