"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { clsx } from "clsx";

// Route label mapping — keeps breadcrumb labels clean and readable
const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "POS",
  inventory: "Products",
  customers: "Customers",
  suppliers: "Suppliers",
  purchases: "Purchase Bills",
  bom: "BOM / Packing",
  sales: "Invoices",
  settings: "Settings",
  accounting: "Accounting",
  "chart-of-accounts": "Chart of Accounts",
  journal: "Journal",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow",
  receivables: "Receivables",
  payables: "Payables",
  expenses: "Expenses",
  payments: "Journal Vouchers",
  "bank-reconciliation": "Bank Reconciliation",
  "cost-centers": "Cost Centers",
  "financial-years": "Financial Years",
  login: "Login",
  onboarding: "Setup",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrent: boolean;
}

export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];

  let path = "";
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`;
    const label = ROUTE_LABELS[segments[i]] || segments[i].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    items.push({
      label,
      href: path,
      isCurrent: i === segments.length - 1,
    });
  }

  return items;
}

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();
  const items = generateBreadcrumbs(pathname);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={clsx("flex items-center gap-1 text-[13px]", className)}>
      <Link
        href="/dashboard"
        className="flex items-center text-text-tertiary hover:text-foreground transition-colors"
        title="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-text-tertiary" />
          {item.isCurrent ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-text-tertiary hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className }: BackButtonProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't show back button on dashboard or root
  if (segments.length <= 1) return null;

  const parentPath = `/${segments.slice(0, -1).join("/")}` || "/dashboard";

  return (
    <Link
      href={parentPath}
      className={clsx(
        "inline-flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-foreground transition-colors",
        className
      )}
      title="Go back"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 12L6 8L10 4" />
      </svg>
      Back
    </Link>
  );
}
