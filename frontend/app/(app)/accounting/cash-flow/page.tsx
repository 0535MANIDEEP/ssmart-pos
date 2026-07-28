"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface CashFlowData {
  operating: { inflow: number; outflow: number };
  investing: { inflow: number; outflow: number };
  financing: { inflow: number; outflow: number };
}

export default function CashFlowPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const result = await api.get<CashFlowData>(`/accounting/cash-flow?${params.toString()}`);
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate]);

  const netCashFlow = data
    ? (data.operating.inflow - data.operating.outflow) +
      (data.investing.inflow - data.investing.outflow) +
      (data.financing.inflow - data.financing.outflow)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Banknote} title="Cash Flow Statement" subtitle="Cash movements across operating, investing and financing activities." />

      {error && (
        <div className="rounded border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-foreground/50">No data found.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <CashFlowSection title="Operating Activities" section={data.operating} money={money} />
            <CashFlowSection title="Investing Activities" section={data.investing} money={money} />
            <CashFlowSection title="Financing Activities" section={data.financing} money={money} />

            <div className="border-t border-border pt-4">
              <div className={`flex items-center justify-between rounded border p-4 text-[13px] font-semibold ${
                netCashFlow >= 0 ? "border-success/20 bg-success/5 text-success" : "border-danger/20 bg-danger/5 text-danger"
              }`}>
                <span>Net Cash Flow</span>
                <span>{money(netCashFlow)}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CashFlowSection({
  title,
  section,
  money,
}: {
  title: string;
  section: { inflow: number; outflow: number };
  money: (n: number) => string;
}) {
  const net = section.inflow - section.outflow;
  return (
    <div className="rounded border border-border p-4">
      <h3 className="mb-3 text-[13px] font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <ArrowDownLeft className="h-4 w-4 text-success" aria-hidden="true" />
            Inflow
          </span>
          <span className="font-medium text-foreground">{money(section.inflow)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <ArrowUpRight className="h-4 w-4 text-danger" aria-hidden="true" />
            Outflow
          </span>
          <span className="font-medium text-foreground">{money(section.outflow)}</span>
        </div>
        <div className="border-t border-border/50 pt-2 flex items-center justify-between text-[13px] font-semibold">
          <span className="text-foreground">Net</span>
          <span className={net >= 0 ? "text-success" : "text-danger"}>{money(net)}</span>
        </div>
      </div>
    </div>
  );
}
