"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileText, Package, Receipt, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useShopSettings } from "@/hooks/useShopSettings";
import { api } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = "\uFEFF";
  const csv = BOM + [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "daily-sale" | "item-wise" | "stock" | "gst";

export default function ReportsPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);
  const [tab, setTab] = useState<Tab>("daily-sale");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "daily-sale", label: "Daily Sale", icon: BarChart3 },
    { key: "item-wise", label: "Item-wise Sales", icon: FileText },
    { key: "stock", label: "Stock Valuation", icon: Package },
    { key: "gst", label: "GST (GSTR-1)", icon: Receipt },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-brand text-white" : "bg-surface-muted text-foreground hover:bg-surface-muted/80"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs font-medium text-foreground/60 block mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground/60 block mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground" />
        </div>
      </div>

      {tab === "daily-sale" && <DailySaleReport from={from} to={to} money={money} />}
      {tab === "item-wise" && <ItemWiseReport from={from} to={to} money={money} />}
      {tab === "stock" && <StockReport money={money} />}
      {tab === "gst" && <GSTReport from={from} to={to} money={money} />}
    </div>
  );
}

function DailySaleReport({ from, to, money }: { from: string; to: string; money: (n: number) => string }) {
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["daily-sale", from, to],
    queryFn: () => api.get(`/invoices/reports/daily-sale?from=${from}&to=${to}`),
    enabled: true,
  });
  const totalGross = rows.reduce((s: number, r: any) => s + r.gross, 0);
  const totalTax = rows.reduce((s: number, r: any) => s + r.tax, 0);
  const totalDiscount = rows.reduce((s: number, r: any) => s + r.discount, 0);
  const totalNet = totalGross - totalDiscount;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Daily Sale Summary</h2>
          <Button variant="secondary" size="sm" onClick={() => {
            const headers = ["Date", "Invoices", "Gross", "Discount", "Tax", "Net"];
            const data = rows.map((r: any) => [
              r.date, r.invoiceCount, money(r.gross), money(r.discount), money(r.tax), money(r.net)
            ]);
            const totals = ["TOTAL", rows.length, money(totalGross), money(totalDiscount), money(totalTax), money(totalNet)];
            downloadCSV(`daily-sale-${from}-to-${to}.csv`, headers, [...data, totals]);
          }}><Download className="h-3 w-3" /> Export CSV</Button>
      {isLoading ? <p className="text-sm text-foreground/50">Loading...</p> : rows.length === 0 ? (
        <p className="text-sm text-foreground/50">No sales in this period</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-medium text-foreground/60">Date</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Invoices</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Gross</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Discount</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Tax</th>
                  <th className="py-2 text-right font-medium text-foreground/60">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.date} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">{formatDate(r.date)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{r.count}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(r.gross)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{r.discount > 0 ? money(r.discount) : "—"}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(r.tax)}</td>
                    <td className="py-2 text-right font-medium text-foreground">{money(r.gross - r.discount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-4 text-foreground">Total</td>
                  <td className="py-2 pr-4 text-right text-foreground">{rows.reduce((s: number, r: any) => s + r.count, 0)}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{money(totalGross)}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{totalDiscount > 0 ? money(totalDiscount) : "—"}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{money(totalTax)}</td>
                  <td className="py-2 text-right text-foreground">{money(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function ItemWiseReport({ from, to, money }: { from: string; to: string; money: (n: number) => string }) {
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["item-wise", from, to],
    queryFn: () => api.get(`/invoices/reports/item-wise?from=${from}&to=${to}`),
    enabled: true,
  });

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Item-wise Sales</h2>
          <Button variant="secondary" size="sm" onClick={() => {
            const headers = ["Product", "Qty Sold", "Revenue", "Tax"];
            const data = rows.map((r: any) => [r.name, r.quantity, money(r.total), money(r.tax)]);
            downloadCSV(`item-wise-${from}-to-${to}.csv`, headers, data);
          }}><Download className="h-3 w-3" /> Export CSV</Button>
      {isLoading ? <p className="text-sm text-foreground/50">Loading...</p> : rows.length === 0 ? (
        <p className="text-sm text-foreground/50">No sales in this period</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 text-left font-medium text-foreground/60">Product</th>
                <th className="py-2 pr-4 text-right font-medium text-foreground/60">Qty Sold</th>
                <th className="py-2 pr-4 text-right font-medium text-foreground/60">Revenue</th>
                <th className="py-2 text-right font-medium text-foreground/60">Tax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.productId} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-foreground">{r.name}</td>
                  <td className="py-2 pr-4 text-right text-foreground/70">{r.totalQty}</td>
                  <td className="py-2 pr-4 text-right text-foreground/70">{money(r.totalRevenue)}</td>
                  <td className="py-2 text-right text-foreground/70">{money(r.totalTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StockReport({ money }: { money: (n: number) => string }) {
  const { data, isLoading } = useQuery<{ products: any[]; totals: any }>({
    queryKey: ["stock-valuation"],
    queryFn: () => api.get("/invoices/reports/stock-valuation"),
    enabled: true,
  });

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Stock Valuation</h2>
          <Button variant="secondary" size="sm" onClick={() => {
            const headers = ["Product", "Stock", "Cost", "MRP", "Stock Value", "Retail Value"];
            const products = (data?.products || []).map((p: any) => [
              p.name, `${p.stock} ${p.unit || ""}`, money(p.purchasePrice), money(p.sellingPrice), money(p.stockValue), money(p.retailValue)
            ]);
            downloadCSV("stock-valuation.csv", headers, products);
          }}><Download className="h-3 w-3" /> Export CSV</Button>
        {isLoading ? <p className="text-sm text-foreground/50">Loading...</p> : !data ? (
        <p className="text-sm text-foreground/50">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="rounded-lg bg-surface-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{data.totals.totalItems}</p>
              <p className="text-xs text-foreground/60">Total Units</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{money(data.totals.totalCostValue)}</p>
              <p className="text-xs text-foreground/60">Cost Value</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{money(data.totals.totalRetailValue)}</p>
              <p className="text-xs text-foreground/60">Retail Value</p>
            </div>
            <div className="rounded-lg bg-warning/10 p-3 text-center">
              <p className="text-2xl font-bold text-warning">{data.totals.lowStockCount}</p>
              <p className="text-xs text-foreground/60">Low Stock</p>
            </div>
            <div className="rounded-lg bg-danger/10 p-3 text-center">
              <p className="text-2xl font-bold text-danger">{data.totals.expiredCount}</p>
              <p className="text-xs text-foreground/60">Expired</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-medium text-foreground/60">Product</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Stock</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Cost</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">MRP</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Stock Value</th>
                  <th className="py-2 text-right font-medium text-foreground/60">Retail Value</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">
                      <span className="text-foreground">{p.name}</span>
                      {p.expired && <span className="ml-1 rounded bg-danger/10 px-1 text-[10px] text-danger">EXP</span>}
                      {p.lowStock && !p.expired && <span className="ml-1 rounded bg-warning/10 px-1 text-[10px] text-warning">LOW</span>}
                    </td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{p.stock} {p.unit || ""}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(p.purchasePrice)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(p.mrp || p.sellingPrice)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(p.stockValue)}</td>
                    <td className="py-2 text-right font-medium text-foreground">{money(p.retailValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function GSTReport({ from, to, money }: { from: string; to: string; money: (n: number) => string }) {
  const { data, isLoading } = useQuery<{ period: any; rates: any[]; totalTaxable: number; totalTax: number }>({
    queryKey: ["gst-report", from, to],
    queryFn: () => api.get(`/invoices/reports/gst?from=${from}&to=${to}`),
    enabled: true,
  });

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">GST Report (GSTR-1 Summary)</h2>
          <Button variant="secondary" size="sm" onClick={() => {
            const headers = ["GST Rate", "Taxable Amount", "Tax Amount", "CGST", "SGST"];
            const rates = (data?.rates || []).map((r: any) => [
              `${r.rate}%`, money(r.taxable), money(r.tax), money(r.cgst), money(r.sgst)
            ]);
            const total = ["TOTAL", money(data?.totalTaxable || 0), money(data?.totalTax || 0), "", ""];
            downloadCSV(`gst-report-${from}-to-${to}.csv`, headers, [...rates, total]);
          }}><Download className="h-3 w-3" /> Export CSV</Button>
      {isLoading ? <p className="text-sm text-foreground/50">Loading...</p> : !data ? (
        <p className="text-sm text-foreground/50">No data</p>
      ) : (
        <>
          <p className="text-sm text-foreground/60 mb-4">Period: {data.period.from} to {data.period.to}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-medium text-foreground/60">GST Rate</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Taxable Amount</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">Tax Amount</th>
                  <th className="py-2 pr-4 text-right font-medium text-foreground/60">CGST</th>
                  <th className="py-2 text-right font-medium text-foreground/60">SGST</th>
                </tr>
              </thead>
              <tbody>
                {data.rates.map((r: any) => (
                  <tr key={r.rate} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-foreground">{r.rate}%</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(r.taxableAmount)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(r.taxAmount)}</td>
                    <td className="py-2 pr-4 text-right text-foreground/70">{money(r.taxAmount / 2)}</td>
                    <td className="py-2 text-right text-foreground/70">{money(r.taxAmount / 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2 pr-4 text-foreground">Total</td>
                  <td className="py-2 pr-4 text-right text-foreground">{money(data.totalTaxable)}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{money(data.totalTax)}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{money(data.totalTax / 2)}</td>
                  <td className="py-2 text-right text-foreground">{money(data.totalTax / 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
