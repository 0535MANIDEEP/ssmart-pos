import { formatMoney } from "./format";
import type { CartItem } from "./types";

interface OfflineReceiptData {
  invoiceNumber: string;
  customerName: string;
  cart: CartItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  loyaltyDiscount: number;
  payments: { method: string; amount: number }[];
  changeDue: number;
  currencySymbol: string;
  shopName?: string;
  shopAddress?: string;
  shopCity?: string;
  shopPhone?: string;
  gstin?: string;
  createdAt?: string;
}

const LINE_WIDTH = 48;

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : " ".repeat(len - str.length) + str;
}

function centered(str: string): string {
  const padding = Math.max(0, Math.floor((LINE_WIDTH - str.length) / 2));
  return " ".repeat(padding) + str;
}

function divider(): string {
  return "-".repeat(LINE_WIDTH);
}

export function generateOfflineReceipt(data: OfflineReceiptData): string {
  const lines: string[] = [];
  const sym = data.currencySymbol;
  const money = (n: number) => formatMoney(n, sym);
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-IN")
    : new Date().toLocaleString("en-IN");

  // Header
  lines.push(centered(data.shopName || "SS Mart"));
  if (data.shopAddress) lines.push(centered(data.shopAddress));
  if (data.shopCity) lines.push(centered(data.shopCity));
  if (data.shopPhone) lines.push(centered(`Ph: ${data.shopPhone}`));
  if (data.gstin) lines.push(centered(`GSTIN: ${data.gstin}`));
  lines.push(divider());
  lines.push(centered("** OFFLINE SALE **"));
  lines.push(divider());

  // Invoice info
  lines.push(`Invoice: ${data.invoiceNumber}`);
  lines.push(`Date: ${date}`);
  if (data.customerName && data.customerName !== "Walk-in") {
    lines.push(`Customer: ${data.customerName}`);
  }
  lines.push(divider());

  // Items
  lines.push(padRight("Item", 28) + padLeft("Qty", 4) + padLeft("Amount", 10));
  lines.push(divider());

  for (const item of data.cart) {
    const ep = item.product.sellingPrice || item.product.mrp;
    const lineTotal = ep * item.quantity;
    const name = item.product.name.length > 27 ? item.product.name.slice(0, 24) + "..." : item.product.name;
    lines.push(padRight(name, 28) + padLeft(String(item.quantity), 4) + padLeft(money(lineTotal), 10));
    if (item.discountType && item.discountValue > 0) {
      const discLabel = item.discountType === "percent" ? `${item.discountValue}% off` : `${money(item.discountValue)} off`;
      lines.push(padRight(`  Disc: ${discLabel}`, 38) + padLeft(`-${money(item.discountType === "percent" ? ep * item.quantity * item.discountValue / 100 : item.discountValue)}`, 10));
    }
  }

  lines.push(divider());

  // Totals
  lines.push(padRight("Subtotal", 38) + padLeft(money(data.totalAmount + data.discountAmount + data.taxAmount + data.loyaltyDiscount), 10));
  if (data.discountAmount > 0) {
    lines.push(padRight("Discount", 38) + padLeft(`-${money(data.discountAmount)}`, 10));
  }
  if (data.taxAmount > 0) {
    lines.push(padRight("GST (included)", 38) + padLeft(money(data.taxAmount), 10));
  }
  if (data.loyaltyDiscount > 0) {
    lines.push(padRight("Loyalty Points", 38) + padLeft(`-${money(data.loyaltyDiscount)}`, 10));
  }
  lines.push(divider());
  lines.push(padRight("TOTAL", 38) + padLeft(money(data.totalAmount), 10));
  lines.push(divider());

  // Payments
  for (const p of data.payments) {
    if (p.amount > 0) {
      lines.push(padRight(`Paid (${p.method})`, 38) + padLeft(money(p.amount), 10));
    }
  }
  if (data.changeDue > 0) {
    lines.push(padRight("Change Due", 38) + padLeft(money(data.changeDue), 10));
  }

  lines.push(divider());
  lines.push(centered("Thank you for shopping!"));
  lines.push(centered("This is an offline-generated receipt."));
  lines.push(centered("Will sync with server when online."));
  lines.push("");
  lines.push(centered(`Generated: ${date}`));

  return lines.join("\n");
}

export function printOfflineReceipt(data: OfflineReceiptData): void {
  const receipt = generateOfflineReceipt(data);
  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${data.invoiceNumber}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 10px;
          white-space: pre;
          background: white;
          color: black;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <pre>${receipt}</pre>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
