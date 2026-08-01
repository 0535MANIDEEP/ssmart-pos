"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Users,
  ReceiptText,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  ChevronLeft,
  Calendar,
  Building2,
  Factory,
  BarChart3,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useMe } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Breadcrumb, BackButton } from "@/components/Breadcrumb";
import { ThemeToggleCompact } from "@/components/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Permission } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ScanBarcode, permission: "invoices:create" },
  { href: "/inventory", label: "Products", icon: Package, permission: "products:read" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers:read" },
  { href: "/salesmen", label: "Salesmen", icon: Users, permission: "customers:read" },
  { href: "/suppliers", label: "Suppliers", icon: Building2, permission: "suppliers:read" },
  { href: "/purchases", label: "Purchases", icon: ReceiptText, permission: "purchases:read" },
  { href: "/bom", label: "BOM / Packing", icon: Factory, permission: "products:read" },
  { href: "/packing", label: "Packing", icon: Package, permission: "products:write" },
  { href: "/sales", label: "Invoices", icon: ReceiptText, permission: "invoices:read" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "invoices:read" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings:write" },
];

const ACCOUNTING_ITEMS = [
  { href: "/accounting", label: "Overview" },
  { href: "/accounting/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/accounting/journal", label: "Journal" },
  { href: "/accounting/trial-balance", label: "Trial Balance" },
  { href: "/accounting/profit-loss", label: "Profit & Loss" },
  { href: "/accounting/balance-sheet", label: "Balance Sheet" },
  { href: "/accounting/cash-flow", label: "Cash Flow" },
  { href: "/accounting/receivables", label: "Receivables" },
  { href: "/accounting/payables", label: "Payables" },
  { href: "/accounting/expenses", label: "Expenses" },
  { href: "/accounting/payments", label: "Journal Vouchers" },
  { href: "/accounting/bank-reconciliation", label: "Bank Reconciliation" },
  { href: "/accounting/cost-centers", label: "Cost Centers" },
  { href: "/accounting/financial-years", label: "Financial Years" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: shop } = useShopSettings();
  const { data: me } = useMe();
  const { data: perms } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountingOpen, setAccountingOpen] = useState(() =>
    pathname.startsWith("/accounting")
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const userPerms = perms?.permissions ?? [];

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await api.post("/auth/logout");
    router.replace("/login");
  }

  function hasPermission(permission?: Permission): boolean {
    if (!permission) return true;
    return userPerms.includes(permission);
  }

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));
  const canAccessAccounting = userPerms.includes("accounting:read");
  const sidebarW = collapsed ? "w-14" : "w-56";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 lg:static lg:z-auto",
          "bg-gradient-to-b from-sidebar-bg to-[#0c1524]",
          sidebarW,
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={clsx("flex h-14 items-center border-b border-sidebar-border px-3", collapsed && "justify-center px-2")}>
          {!collapsed ? (
            <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-500 shadow-brand">
                <span className="text-xs font-bold text-white">SS</span>
              </div>
              <span className="truncate text-sm font-semibold text-sidebar-text-active">
                {shop?.shopName || "SS Mart"}
              </span>
            </Link>
          ) : (
            <Tooltip content={shop?.shopName || "SS Mart"} side="right">
              <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-500 shadow-brand">
                <span className="text-xs font-bold text-white">SS</span>
              </Link>
            </Tooltip>
          )}
        </div>

        {/* Navigation */}
        <nav className={clsx("flex-1 px-2 py-3", collapsed ? "overflow-visible" : "overflow-y-auto")}>
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-brand/15 text-white shadow-sm"
                      : "text-sidebar-text hover:bg-white/5 hover:text-sidebar-text-active"
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0", active && "text-brand-400")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {active && !collapsed && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400" />
                  )}
                </Link>
              );

              return collapsed ? (
                <Tooltip key={item.href} content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                <div key={item.href}>{link}</div>
              );
            })}
          </div>

          {/* Accounting section */}
          {canAccessAccounting && (
            <div className="mt-4">
              {collapsed ? (
                <Tooltip content="Accounting" side="right">
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsed(false);
                      setAccountingOpen(true);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-center rounded-lg px-2 py-2 text-[13px] font-medium transition-colors text-sidebar-text hover:bg-white/5 hover:text-sidebar-text-active"
                    )}
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>
                </Tooltip>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountingOpen((v) => !v)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-sidebar-text hover:bg-white/5 hover:text-sidebar-text-active"
                  >
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">Accounting</span>
                    {accountingOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {accountingOpen && (
                    <div className="ml-3.5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {ACCOUNTING_ITEMS.map((item) => {
                        const active = pathname === item.href || (item.href !== "/accounting" && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={clsx(
                              "block truncate rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                              active
                                ? "bg-brand/15 text-white"
                                : "text-sidebar-text/60 hover:text-sidebar-text-active hover:bg-white/5"
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex w-full items-center justify-center rounded-lg py-2 text-sidebar-text transition-colors hover:bg-white/5 hover:text-sidebar-text-active"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-header-border bg-header-bg px-4 lg:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-muted lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <BackButton />

            {/* Breadcrumb — hidden on mobile, shown on desktop */}
            <Breadcrumb className="hidden md:flex" />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Search */}
            <Tooltip content="Search" side="bottom">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="search"
                  placeholder="Search..."
                  className="h-8 w-48 rounded-lg border border-border bg-surface-muted pl-7 pr-2 text-[12px] text-foreground placeholder:text-text-tertiary transition-all duration-150 hover:border-border-strong focus:border-brand focus:ring-2 focus:ring-brand/10 focus:outline-none"
                />
              </div>
            </Tooltip>

            {/* Theme toggle */}
            <Tooltip content="Toggle theme" side="bottom">
              <ThemeToggleCompact />
            </Tooltip>

            {/* Notifications placeholder — will be wired when notification backend is ready */}
            {/* <Tooltip content="Notifications" side="bottom">
              <button type="button" className="relative flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-muted transition-colors">
                <Bell className="h-3.5 w-3.5" />
              </button>
            </Tooltip> */}

            {/* User menu */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-surface-muted transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-brand/10 text-[10px] font-semibold text-brand">
                  {me?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span className="hidden text-[12px] font-medium text-foreground md:block">{me?.name || "User"}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-lg">
                  <div className="border-b border-border px-3 py-1.5">
                    <p className="text-[12px] font-medium text-foreground truncate">{me?.name}</p>
                    <p className="text-[11px] text-text-tertiary truncate">{me?.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-muted"
                  >
                    <Settings className="h-3 w-3" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-danger hover:bg-danger-light"
                  >
                    <LogOut className="h-3 w-3" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
