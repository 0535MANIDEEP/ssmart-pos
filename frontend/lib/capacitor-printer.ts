// frontend/lib/capacitor-printer.ts
// ==========================================
// SS Mart — Capacitor Thermal Printer
// Uses Bluetooth ESC/POS on mobile
// ==========================================

import { Capacitor } from '@capacitor/core';

let BluetoothSerial: any = null;

async function loadBluetooth() {
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('capacitor-bluetooth-serial');
      BluetoothSerial = mod.BluetoothSerial;
    } catch {
      console.warn('BluetoothSerial plugin not available');
    }
  }
}

export async function isBluetoothAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await loadBluetooth();
  if (!BluetoothSerial) return false;

  try {
    const enabled = await BluetoothSerial.isEnabled();
    return enabled;
  } catch {
    return false;
  }
}

export async function listPairedDevices(): Promise<
  Array<{ id: string; name: string }>
> {
  if (!Capacitor.isNativePlatform()) return [];
  await loadBluetooth();
  if (!BluetoothSerial) return [];

  try {
    const devices = await BluetoothSerial.list();
    return devices.map((d: any) => ({
      id: d.id,
      name: d.name || d.id,
    }));
  } catch {
    return [];
  }
}

export async function connectToDevice(
  deviceId: string
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await loadBluetooth();
  if (!BluetoothSerial) return false;

  try {
    await BluetoothSerial.connect({ deviceId });
    return true;
  } catch {
    return false;
  }
}

export async function disconnect(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await loadBluetooth();
  if (BluetoothSerial) {
    try {
      await BluetoothSerial.disconnect();
    } catch {}
  }
}

// ESC/POS commands
const ESC = '\x1b';
const GS = '\x1d';

function initializePrinter(): string {
  return `${ESC}@`; // Initialize printer
}

function setBold(on: boolean): string {
  return `${ESC}E${on ? '\x01' : '\x00'}`;
}

function setFontSize(width: number, height: number): string {
  return `${GS}!${String.fromCharCode((width - 1) * 16 + (height - 1))}`;
}

function alignCenter(): string {
  return `${ESC}a\x01`;
}

function alignLeft(): string {
  return `${ESC}a\x00`;
}

function cutPaper(): string {
  return `${GS}V\x01`;
}

function feedLines(n: number): string {
  return `${ESC}d${String.fromCharCode(n)}`;
}

// Format Indian Rupee
function formatINR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface ThermalReceiptData {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopGstin: string;
  invoiceNumber: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
    gstRate: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  balance: number;
  salesman?: string;
  loyaltyPoints?: number;
}

export function generateEscPosReceipt(data: ThermalReceiptData): string {
  let receipt = '';

  receipt += initializePrinter();
  receipt += setFontSize(2, 2);
  receipt += alignCenter();
  receipt += setBold(true);
  receipt += `${data.shopName}\n`;
  receipt += setFontSize(1, 1);
  receipt += setBold(false);
  receipt += `${data.shopAddress}\n`;
  if (data.shopPhone) receipt += `Ph: ${data.shopPhone}\n`;
  if (data.shopGstin) receipt += `GSTIN: ${data.shopGstin}\n`;
  receipt += `${'─'.repeat(32)}\n`;

  receipt += setBold(true);
  receipt += `TAX INVOICE\n`;
  receipt += setBold(false);
  receipt += `Inv: ${data.invoiceNumber}\n`;
  receipt += `Date: ${data.date}\n`;
  if (data.salesman) receipt += `By: ${data.salesman}\n`;
  receipt += `${'─'.repeat(32)}\n`;

  receipt += alignLeft();

  for (const item of data.items) {
    receipt += `${item.name}\n`;
    receipt += `  ${item.quantity} ${item.unit} x ${formatINR(item.price)}`;
    receipt += `  ${formatINR(item.total)}\n`;
  }

  receipt += `${'─'.repeat(32)}\n`;
  receipt += setBold(true);
  receipt += `Subtotal:     ${formatINR(data.subtotal)}\n`;
  receipt += `Tax (GST):    ${formatINR(data.taxAmount)}\n`;
  receipt += `TOTAL:        ${formatINR(data.total)}\n`;
  receipt += setBold(false);
  receipt += `${'─'.repeat(32)}\n`;

  receipt += `Payment: ${data.paymentMethod}\n`;
  receipt += `Paid:    ${formatINR(data.amountPaid)}\n`;
  if (data.balance > 0) {
    receipt += `Balance: ${formatINR(data.balance)}\n`;
  }

  if (data.loyaltyPoints && data.loyaltyPoints > 0) {
    receipt += `\nLoyalty Points: +${data.loyaltyPoints}\n`;
  }

  receipt += `${'─'.repeat(32)}\n`;
  receipt += alignCenter();
  receipt += setFontSize(1, 1);
  receipt += `Thank you! Visit again.\n`;
  receipt += feedLines(3);
  receipt += cutPaper();

  return receipt;
}

export async function printReceipt(
  data: ThermalReceiptData,
  deviceId?: string
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.warn('Bluetooth printing only available on mobile');
    return false;
  }

  await loadBluetooth();
  if (!BluetoothSerial) return false;

  try {
    if (deviceId) {
      await connectToDevice(deviceId);
    }

    const escpos = generateEscPosReceipt(data);

    // Convert string to bytes for transmission
    const encoder = new TextEncoder();
    const bytes = encoder.encode(escpos);

    await BluetoothSerial.write({ data: bytes.buffer });

    return true;
  } catch (err) {
    console.error('Print error:', err);
    return false;
  }
}
