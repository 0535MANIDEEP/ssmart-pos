"use client";

import Link from "next/link";
import { AlertTriangle, Award, Download, Package, Receipt, Star, TrendingUp, ArrowUpRight, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SalesCharts } from "@/components/SalesCharts";
import { useLowStock, useProducts } from "@/hooks/useProducts";
import { useInvoices, useSalesAnalytics, useSalesSummary } from "@/hooks/useInvoices";
import { useTopLoyaltyCustomers } from "@/hooks/useCustomers";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney, formatDateTime } from "@/lib/format";

export default function DashboardPage() {
  const { data: shop } = useShopSettings();
  const { data: products } = useProducts();
  const { data: lowStock } = useLowStock();
  const { data: summary } = useSalesSummary();
  const { data: invoices } = useInvoices();
  const { data: analytics } = useSalesAnalytics();
  const { data: topCustomers } = useTopLoyaltyCustomers(10);

  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);
  const bestSeller = analytics?.topProducts[0];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-text-secondary">{shop?.shopName || "SS Mart"} — Today&apos;s overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos">
            <Button variant="primary" size="sm">
              <ShoppingCart className="h-4 w-4" />
              Open POS
            </Button>
          </Link>
          <a href="/api/invoices/export.csv" download>
            <Button variant="secondary" size="sm">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Receipt}
          label="Today's Sales"
          value={`${summary?.todaysCount ?? 0}`}
          iconBg="bg-brand-light"
          iconColor="text-brand"
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Revenue"
          value={money(summary?.todaysRevenue ?? 0)}
          iconBg="bg-success-light"
          iconColor="text-success"
        />
        <StatCard
          icon={Package}
          label="Total Products"
          value={`${products?.length ?? 0}`}
          iconBg="bg-info-light"
          iconColor="text-info"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={`${lowStock?.products.length ?? 0}`}
          iconBg={lowStock?.products.length ? "bg-warning-light" : "bg-surface-muted"}
          iconColor={lowStock?.products.length ? "text-warning" : "text-text-secondary"}
          accent={lowStock?.products.length ? "warning" : undefined}
        />
      </div>

      {/* Best seller */}
      {bestSeller && bestSeller.quantity > 0 && (
        <Card variant="brand" className="flex items-center gap-4 p-5 animate-slide-up">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Award className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium text-text-secondary">Best seller (last 14 days)</p>
            <p className="text-base font-semibold text-foreground">
              {bestSeller.name}
              <span className="ml-2 font-normal text-text-secondary">
                {bestSeller.quantity} sold · {money(bestSeller.revenue)}
              </span>
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-brand/40" />
        </Card>
      )}

      {/* Charts */}
      <SalesCharts sym={sym} />

      {/* Two-column: Low stock + Top customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Low Inventory</h2>
            <Link href="/inventory" className="text-xs font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          {!lowStock || lowStock.products.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-light text-success">
                <Package className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">All stocked up</p>
              <p className="text-xs text-text-tertiary">No items below threshold ({lowStock?.threshold ?? 5})</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lowStock.products.map((product) => (
                <li key={product.id} className="flex items-center justify-between py-3 hover:bg-surface-muted/50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-text-tertiary">SKU: {product.barcode}</p>
                  </div>
                  <span className="ml-4 shrink-0 rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">
                    {product.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Top Customers</h2>
            <Link href="/customers" className="text-xs font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          {!topCustomers || topCustomers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
                <Users className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">No loyalty data yet</p>
              <p className="text-xs text-text-tertiary">Points will appear as customers make purchases</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {topCustomers.map((customer, i) => (
                <li key={customer.id} className="flex items-center justify-between py-3 hover:bg-surface-muted/50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0 ? "bg-warning text-white" :
                      i === 1 ? "bg-border-strong text-foreground" :
                      i === 2 ? "bg-brand/20 text-brand" :
                      "bg-surface-muted text-text-secondary"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
                      <p className="text-xs text-text-tertiary">{customer.phone}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">
                    <Star className="h-3 w-3 fill-current" />
                    {customer.loyaltyPoints}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent invoices */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent Sales</h2>
          <Link href="/sales" className="text-xs font-medium text-brand hover:underline">
            View all →
          </Link>
        </div>
        {!invoices || invoices.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">
              <Receipt className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No sales yet</p>
            <p className="text-xs text-text-tertiary">Start selling to see transactions here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-text-tertiary">
                  <th className="pb-3 pr-4 font-semibold">Invoice</th>
                  <th className="pb-3 pr-4 font-semibold">Customer</th>
                  <th className="pb-3 pr-4 font-semibold">Date</th>
                  <th className="pb-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {invoices.slice(0, 8).map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="py-3 pr-4 text-text-secondary">{inv.customerName}</td>
                    <td className="py-3 pr-4 text-text-secondary">{formatDateTime(inv.createdAt)}</td>
                    <td className="py-3 text-right font-semibold text-foreground">{money(inv.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  accent?: "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-secondary">{label}</p>
          <p className="text-xl font-bold text-foreground tracking-tight truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
