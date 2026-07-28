export type Role = "admin" | "manager" | "accountant" | "cashier";

export type Permission =
  | "products:read" | "products:write" | "products:delete"
  | "customers:read" | "customers:write"
  | "invoices:read" | "invoices:create" | "invoices:return"
  | "suppliers:read" | "suppliers:write" | "suppliers:delete"
  | "purchases:read" | "purchases:create" | "purchases:return"
  | "accounting:read" | "accounting:write" | "accounting:manage"
  | "expenses:read" | "expenses:write"
  | "reports:view"
  | "settings:read" | "settings:write"
  | "users:read" | "users:manage"
  | "backup:manage"
  | "migration:run";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface PermissionsResponse {
  permissions: Permission[];
  role: Role;
}

export interface ShopSettings {
  id: number;
  shopName: string;
  legalName: string | null;
  address1: string;
  address2: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  currencyCode: string;
  currencySymbol: string;
  gstEnabled: boolean;
  gstNumber: string | null;
  panNumber: string | null;
  defaultTaxRate: number;
  loyaltyEnabled: boolean;
  pointsPerUnit: number;
  pointValue: number;
  receiptHeader: string | null;
  receiptFooter: string;
  showGst: boolean;
  autoPrintReceipt: boolean;
  usbPrinterWidth: number;
  autoPrintMethod: "browser" | "usb";
  lowStockAlert: number;
  allowNegativeStock: boolean;
  pincode: string | null;
  showHsnOnPdf: boolean;
  backupSchedule: string;
  backupRetention: number;
}

export interface Product {
  id: number;
  barcode: string;
  name: string;
  category: string | null;
  hsn: string | null;
  unit: string | null;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  discountType: "percent" | "amount" | null;
  discountValue: number;
  stock: number;
  isBulk: boolean;
  packSize: number | null;
  bulkProductId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  totalDue: number;
  creditBalance: number;
  visits: number;
  createdAt: string;
}

export interface InvoiceItem {
  id: number;
  productId: number;
  name: string;
  unit: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  subtotal: number;
  discountType: "percent" | "amount" | null;
  discountValue: number;
  discountAmount: number;
  taxAmount: number;
  loyaltyDiscount: number;
  totalAmount: number;
  paymentMethod: "CASH" | "UPI" | "CARD";
  amountPaid: number;
  changeDue: number;
  dueAmount: number;
  previousDuePaid: number;
  returnValue: number;
  creditApplied: number;
  refundValue: number;
  refundMode: "CASH" | "CREDIT" | null;
  pointsRedeemed: number;
  pointsEarned: number;
  createdAt: string;
  items: InvoiceItem[];
  payments?: InvoicePayment[];
}

export interface InvoicePayment {
  method: "CASH" | "UPI" | "CARD";
  amount: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PaymentMethod = "CASH" | "UPI" | "CARD";

export type RefundMethod = "CASH" | "UPI" | "CARD" | "DUE_ADJUST";

export interface ReturnItem {
  id: number;
  invoiceItemId: number;
  productId: number;
  name: string;
  quantity: number;
  refundAmount: number;
}

export interface ReturnRecord {
  id: number;
  invoiceId: number;
  customerId: number | null;
  totalRefund: number;
  refundMethod: RefundMethod;
  note: string | null;
  createdAt: string;
  items: ReturnItem[];
}

// ═══════════════════════════════════════════════════════════════
// SUPPLIER & PURCHASE
// ═══════════════════════════════════════════════════════════════

export interface Supplier {
  id: number;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactPerson: string | null;
  paymentTerms: string | null;
  outstandingBalance: number;
  isActive: boolean;
  createdAt: string;
  _count?: { purchaseInvoices: number };
}

export interface PurchaseItem {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  batchNumber: string | null;
  expiryDate: string | null;
  product?: { id: number; name: string; barcode: string };
}

export interface PurchaseInvoice {
  id: number;
  supplierId: number;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: "pending" | "partial" | "paid" | "returned";
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  supplier?: { id: number; name: string };
  items: PurchaseItem[];
}

// ═══════════════════════════════════════════════════════════════
// BILL OF MATERIALS
// ═══════════════════════════════════════════════════════════════

export interface BomItem {
  id: number;
  productId: number;
  quantity: number;
  unit: string | null;
  product?: { id: number; name: string; barcode: string; unit: string | null };
}

export interface BillOfMaterial {
  id: number;
  name: string;
  description: string | null;
  outputProductId: number;
  outputQuantity: number;
  isActive: boolean;
  createdAt: string;
  outputProduct?: { id: number; name: string; barcode: string; unit: string | null };
  items: BomItem[];
}
