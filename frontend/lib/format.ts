// Indian number grouping: 1,00,000.00 instead of 100,000.00
function indianGrouping(n: number): string {
  const [intPart, decPart] = n.toFixed(2).split(".");
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  if (!rest) return `${last3}.${decPart}`;
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${grouped},${last3}.${decPart}`;
}

// Formats a numeric amount with the shop's currency symbol using Indian
// grouping (lakhs/crores). Falls back to standard grouping for non-INR.
export function formatMoney(amount: number, symbol = "\u20B9"): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const formatted = symbol === "\u20B9" ? indianGrouping(n) : n.toFixed(2);
  return `${symbol} ${formatted}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// DD/MM/YYYY date format (Indian standard)
export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// DD/MM/YYYY HH:MM format for receipts and tables
export function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
