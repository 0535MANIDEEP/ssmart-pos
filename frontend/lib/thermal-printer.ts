// frontend/lib/thermal-printer.ts
// ==========================================
// SS Mart — Web Serial API Thermal Printer
// Works on Chrome/Edge desktop with USB thermal printers
// ==========================================

// Web Serial API type declarations
declare global {
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
  }

  interface Serial {
    getPorts(): Promise<SerialPort[]>;
    requestPort(options?: { filters?: Array<{ vendorId?: string; productId?: string }> }): Promise<SerialPort>;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  }

  interface Navigator {
    serial?: Serial;
  }
}

export interface ThermalPrinterDevice {
  port: SerialPort;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  baudRate: number;
  vendorId?: string;
  productId?: string;
}

let currentDevice: ThermalPrinterDevice | null = null;

// Check if Web Serial API is supported
export function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}

// List available serial ports
export async function listSerialPorts(): Promise<SerialPort[]> {
  if (!isWebSerialSupported()) return [];

  try {
    const ports = await navigator.serial!.getPorts();
    return ports;
  } catch {
    return [];
  }
}

// Request user to select and connect a printer
export async function connectPrinter(): Promise<ThermalPrinterDevice | null> {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial API not supported. Use Chrome or Edge.');
  }

  try {
    // Prompt user to select a serial port
    const port = await navigator.serial!.requestPort({
      filters: [
        // Common thermal printer vendor/product IDs
        { vendorId: '0x0416', productId: '0x5011' }, // Winbond
        { vendorId: '0x0483', productId: '0xa1f1' }, // STM
        { vendorId: '0x1fc9', productId: '0x0535' }, // NXP
        { vendorId: '0x067b', productId: '0x2303' }, // Prolific
        { vendorId: '0x1a86', productId: '0x7523' }, // CH340
        { vendorId: '0x0403', productId: '0x6001' }, // FTDI
      ],
    });

    // Common baud rates for thermal printers
    const baudRates = [9600, 19200, 38400, 57600, 115200, 230400];

    let connected = false;
    let lastError: Error | null = null;

    for (const baudRate of baudRates) {
      try {
        await port.open({ baudRate });
        connected = true;

        const writer = port.writable!.getWriter();
        const reader = port.readable?.getReader() ?? null;

        currentDevice = {
          port,
          writer,
          reader,
          baudRate,
        };

        return currentDevice;
      } catch (err) {
        lastError = err as Error;
        // Try next baud rate
      }
    }

    if (!connected) {
      throw lastError || new Error('Failed to connect at any baud rate');
    }
  } catch (err) {
    if ((err as Error).name === 'NotFoundError') {
      throw new Error('No printer selected');
    }
    throw err;
  }

  return null;
}

// Reconnect to a previously used port
export async function reconnectPrinter(): Promise<ThermalPrinterDevice | null> {
  if (!isWebSerialSupported()) return null;

  const ports = await listSerialPorts();
  if (ports.length === 0) return null;

  try {
    const port = ports[0];
    const baudRate = 9600;
    await port.open({ baudRate });

    const writer = port.writable!.getWriter();
    const reader = port.readable?.getReader() ?? null;

    currentDevice = { port, writer, reader, baudRate };
    return currentDevice;
  } catch {
    return null;
  }
}

// Disconnect printer
export async function disconnectPrinter(): Promise<void> {
  if (!currentDevice) return;

  try {
    currentDevice.writer.releaseLock();
    if (currentDevice.reader) {
      currentDevice.reader.releaseLock();
    }
    await currentDevice.port.close();
  } catch {}

  currentDevice = null;
}

// Get connected device
export function getCurrentDevice(): ThermalPrinterDevice | null {
  return currentDevice;
}

// Check if printer is connected
export function isPrinterConnected(): boolean {
  return currentDevice !== null && currentDevice.port.readable !== null;
}

// Send raw bytes to printer
async function sendBytes(data: Uint8Array): Promise<void> {
  if (!currentDevice) throw new Error('No printer connected');

  try {
    await currentDevice.writer.write(data);
  } catch (err) {
    // Try to reconnect
    const reconnected = await reconnectPrinter();
    if (!reconnected) throw new Error('Printer disconnected and reconnect failed');
    await currentDevice!.writer.write(data);
  }
}

// ESC/POS Commands
function initializePrinter(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]); // ESC @
}

function setBold(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x45, on ? 0x01 : 0x00]);
}

function setUnderline(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x2d, on ? 0x01 : 0x00]);
}

function setFontSize(width: number, height: number): Uint8Array {
  const size = ((width - 1) << 4) | (height - 1);
  return new Uint8Array([0x1d, 0x21, size]);
}

function alignCenter(): Uint8Array {
  return new Uint8Array([0x1b, 0x61, 0x01]);
}

function alignLeft(): Uint8Array {
  return new Uint8Array([0x1b, 0x61, 0x00]);
}

function alignRight(): Uint8Array {
  return new Uint8Array([0x1b, 0x61, 0x02]);
}

function cutPaper(): Uint8Array {
  return new Uint8Array([0x1d, 0x56, 0x01]); // Full cut
}

function partialCut(): Uint8Array {
  return new Uint8Array([0x1d, 0x56, 0x00]); // Partial cut
}

function feedLines(n: number): Uint8Array {
  return new Uint8Array([0x1b, 0x64, n]);
}

function setLineSpacing(dots: number): Uint8Array {
  return new Uint8Array([0x1b, 0x33, dots]);
}

function openCashDrawer(): Uint8Array {
  return new Uint8Array([0x1b, 0x70, 0x00, 0x0a, 0xfa]); // Pulse drawer 1
}

// Text to bytes
function textToBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

// Create a horizontal line
function horizontalLine(char: string = '-', width: number = 32): Uint8Array {
  return textToBytes(char.repeat(width) + '\n');
}

// Format Indian Rupee
function formatINR(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ==========================================
// Receipt Data Types
// ==========================================

export interface ReceiptItem {
  name: string;
  barcode?: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  gstRate: number;
}

export interface ReceiptData {
  type: 'sale' | 'return' | 'purchase' | 'estimate';
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopGstin: string;
  invoiceNumber: string;
  date: string;
  time: string;
  salesman?: string;
  customer?: {
    name: string;
    phone: string;
    gstin?: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  discountPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  payment: {
    method: string;
    cash: number;
    card: number;
    upi: number;
    credit: number;
  };
  amountPaid: number;
  balance: number;
  loyaltyPoints: {
    earned: number;
    redeemed: number;
    total: number;
  };
  note?: string;
}

// ==========================================
// Print Receipt
// ==========================================

export async function printReceipt(data: ReceiptData): Promise<boolean> {
  if (!currentDevice) {
    throw new Error('No printer connected. Please connect a thermal printer first.');
  }

  const chunks: Uint8Array[] = [];

  // Initialize
  chunks.push(initializePrinter());
  chunks.push(setLineSpacing(30));

  // Shop Header
  chunks.push(alignCenter());
  chunks.push(setFontSize(2, 2));
  chunks.push(setBold(true));
  chunks.push(textToBytes(data.shopName + '\n'));

  chunks.push(setFontSize(1, 1));
  chunks.push(setBold(false));
  chunks.push(textToBytes(data.shopAddress + '\n'));
  if (data.shopPhone) chunks.push(textToBytes('Ph: ' + data.shopPhone + '\n'));
  if (data.shopGstin) chunks.push(textToBytes('GSTIN: ' + data.shopGstin + '\n'));

  chunks.push(horizontalLine('=', 32));

  // Invoice Title
  chunks.push(setBold(true));
  const title = data.type === 'return' ? 'RETURN BILL' :
                data.type === 'purchase' ? 'PURCHASE BILL' :
                data.type === 'estimate' ? 'ESTIMATE' : 'TAX INVOICE';
  chunks.push(setFontSize(1, 2));
  chunks.push(textToBytes(title + '\n'));
  chunks.push(setFontSize(1, 1));
  chunks.push(setBold(false));

  // Invoice Details
  chunks.push(alignLeft());
  chunks.push(textToBytes('Invoice: ' + data.invoiceNumber + '\n'));
  chunks.push(textToBytes('Date:    ' + data.date + '  ' + data.time + '\n'));
  if (data.salesman) chunks.push(textToBytes('By:      ' + data.salesman + '\n'));

  // Customer
  if (data.customer) {
    chunks.push(horizontalLine('-', 32));
    chunks.push(textToBytes('Customer: ' + data.customer.name + '\n'));
    chunks.push(textToBytes('Phone:    ' + data.customer.phone + '\n'));
    if (data.customer.gstin) {
      chunks.push(textToBytes('GSTIN:    ' + data.customer.gstin + '\n'));
    }
  }

  chunks.push(horizontalLine('-', 32));

  // Items Header
  chunks.push(setBold(true));
  chunks.push(textToBytes(padRight('Item', 18) + padLeft('Qty', 5) + padLeft('Amount', 9) + '\n'));
  chunks.push(setBold(false));
  chunks.push(horizontalLine('-', 32));

  // Items
  for (const item of data.items) {
    const nameStr = item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name;
    chunks.push(textToBytes(
      padRight(nameStr, 18) +
      padLeft(item.quantity + ' ' + item.unit, 5) +
      padLeft(formatINR(item.total), 9) + '\n'
    ));
    chunks.push(textToBytes(
      '  ' + padRight('@' + formatINR(item.price), 16) +
      padLeft(item.gstRate + '% GST', 8) + '\n'
    ));
  }

  chunks.push(horizontalLine('-', 32));

  // Totals
  chunks.push(alignRight());
  chunks.push(textToBytes('Subtotal:    ' + padLeft(formatINR(data.subtotal), 10) + '\n'));

  if (data.discount > 0) {
    chunks.push(textToBytes('Discount:    ' + padLeft('-' + formatINR(data.discount), 10) + '\n'));
  }

  // GST breakup
  if (data.cgst > 0) {
    chunks.push(textToBytes('CGST:        ' + padLeft(formatINR(data.cgst), 10) + '\n'));
    chunks.push(textToBytes('SGST:        ' + padLeft(formatINR(data.sgst), 10) + '\n'));
  }
  if (data.igst > 0) {
    chunks.push(textToBytes('IGST:        ' + padLeft(formatINR(data.igst), 10) + '\n'));
  }

  // Total
  chunks.push(horizontalLine('=', 32));
  chunks.push(setBold(true));
  chunks.push(setFontSize(1, 2));
  chunks.push(textToBytes('TOTAL:       ' + padLeft(formatINR(data.total), 10) + '\n'));
  chunks.push(setFontSize(1, 1));
  chunks.push(setBold(false));

  // Payment
  chunks.push(horizontalLine('-', 32));
  chunks.push(alignLeft());

  if (data.payment.cash > 0) {
    chunks.push(textToBytes('Cash:     ' + formatINR(data.payment.cash) + '\n'));
  }
  if (data.payment.card > 0) {
    chunks.push(textToBytes('Card:     ' + formatINR(data.payment.card) + '\n'));
  }
  if (data.payment.upi > 0) {
    chunks.push(textToBytes('UPI:      ' + formatINR(data.payment.upi) + '\n'));
  }
  if (data.payment.credit > 0) {
    chunks.push(textToBytes('Credit:   ' + formatINR(data.payment.credit) + '\n'));
  }

  if (data.balance > 0) {
    chunks.push(setBold(true));
    chunks.push(textToBytes('Balance:  ' + formatINR(data.balance) + '\n'));
    chunks.push(setBold(false));
  }

  // Loyalty
  if (data.loyaltyPoints.earned > 0) {
    chunks.push(horizontalLine('-', 32));
    chunks.push(textToBytes('Points earned: +' + data.loyaltyPoints.earned + '\n'));
    chunks.push(textToBytes('Total points:  ' + data.loyaltyPoints.total + '\n'));
  }

  // Footer
  chunks.push(horizontalLine('=', 32));
  chunks.push(alignCenter());
  chunks.push(textToBytes('Thank you! Visit again.\n'));

  if (data.note) {
    chunks.push(textToBytes(data.note + '\n'));
  }

  // Feed and cut
  chunks.push(feedLines(3));
  chunks.push(cutPaper());

  // Send all bytes
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  await sendBytes(combined);
  return true;
}

// ==========================================
// Print daily cash report
// ==========================================

export async function printDailyCashReport(report: {
  date: string;
  openingBalance: number;
  closingBalance: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalUpi: number;
  totalCredit: number;
  totalReturns: number;
  billCount: number;
  expenses: number;
}): Promise<boolean> {
  if (!currentDevice) throw new Error('No printer connected');

  const chunks: Uint8Array[] = [];

  chunks.push(initializePrinter());
  chunks.push(alignCenter());
  chunks.push(setFontSize(2, 2));
  chunks.push(setBold(true));
  chunks.push(textToBytes('DAILY CASH REPORT\n'));
  chunks.push(setFontSize(1, 1));
  chunks.push(setBold(false));
  chunks.push(textToBytes(report.date + '\n'));
  chunks.push(horizontalLine('=', 32));

  chunks.push(alignLeft());
  chunks.push(textToBytes('Opening Cash:    ' + formatINR(report.openingBalance) + '\n'));
  chunks.push(horizontalLine('-', 32));

  chunks.push(textToBytes('Total Sales:     ' + formatINR(report.totalSales) + '\n'));
  chunks.push(textToBytes('Bills:           ' + report.billCount + '\n'));
  chunks.push(horizontalLine('-', 32));

  chunks.push(textToBytes('Cash:            ' + formatINR(report.totalCash) + '\n'));
  chunks.push(textToBytes('Card:            ' + formatINR(report.totalCard) + '\n'));
  chunks.push(textToBytes('UPI:             ' + formatINR(report.totalUpi) + '\n'));
  chunks.push(textToBytes('Credit:          ' + formatINR(report.totalCredit) + '\n'));
  chunks.push(horizontalLine('-', 32));

  chunks.push(textToBytes('Returns:         -' + formatINR(report.totalReturns) + '\n'));
  chunks.push(textToBytes('Expenses:        -' + formatINR(report.expenses) + '\n'));
  chunks.push(horizontalLine('=', 32));

  chunks.push(setBold(true));
  chunks.push(textToBytes('Closing Cash:    ' + formatINR(report.closingBalance) + '\n'));
  chunks.push(setBold(false));
  chunks.push(horizontalLine('=', 32));

  chunks.push(alignCenter());
  chunks.push(feedLines(3));
  chunks.push(cutPaper());

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  await sendBytes(combined);
  return true;
}

// ==========================================
// Open cash drawer
// ==========================================

export async function openDrawer(): Promise<boolean> {
  if (!currentDevice) throw new Error('No printer connected');
  await sendBytes(openCashDrawer());
  return true;
}

// Helpers
function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

function padLeft(str: string, len: number): string {
  return ' '.repeat(Math.max(0, len - str.length)) + str;
}
