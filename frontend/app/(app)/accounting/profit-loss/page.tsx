"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface PlEntry {
  ledgerId: number;
  ledgerName: string;
  groupName: string;
  debit: number;
  credit: number;
  net: number;
}

interface ProfitLossData {
  income: PlEntry[];
  expenses: PlEntry[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export default function ProfitLossPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [data, setData] = useState<ProfitLossData | null>(null);
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
        const result = await api.get<ProfitLossData>(`/accounting/profit-loss?${params.toString()}`);
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate]);

  const incomeByGroup = groupEntries(data?.income ?? []);
  const expenseByGroup = groupEntries(data?.expenses ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={TrendingUp} title="Profit & Loss Statement" subtitle="Income vs expenses for the selected period." />

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
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
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-text-tertiary">Loading profit & loss…</p>
          </div>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-foreground/50">No data found.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-success">Income</h2>
              <PlSection groups={incomeByGroup} money={money} />
              <div className="mt-3 flex items-center justify-between rounded-xl border-t-2 border-border bg-surface-muted/30 px-4 py-3 text-sm font-bold">
                <span>Total Income</span>
                <span>{money(data.totalIncome)}</span>
              </div>
            </div>

            <div>
              <h2 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-danger">Expenses</h2>
              <PlSection groups={expenseByGroup} money={money} />
              <div className="mt-3 flex items-center justify-between rounded-xl border-t-2 border-border bg-surface-muted/30 px-4 py-3 text-sm font-bold">
                <span>Total Expenses</span>
                <span>{money(data.totalExpense)}</span>
              </div>
            </div>

            <Card
              variant={data.netProfit >= 0 ? "success" : "danger"}
              className="flex items-center justify-between rounded p-5 text-[15px] font-bold shadow-sm"
            >
              <span>{data.netProfit >= 0 ? "Net Profit" : "Net Loss"}</span>
              <span>{money(Math.abs(data.netProfit))}</span>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}

function groupEntries(entries: PlEntry[]): Map<string, PlEntry[]> {
  const map = new Map<string, PlEntry[]>();
  for (const e of entries) {
    const existing = map.get(e.groupName);
    if (existing) {
      existing.push(e);
    } else {
      map.set(e.groupName, [e]);
    }
  }
  return map;
}

function PlSection({
  groups,
  money,
}: {
  groups: Map<string, PlEntry[]>;
  money: (n: number) => string;
}) {
  if (groups.size === 0) {
    return <p className="text-sm text-foreground/50">No entries.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {Array.from(groups.entries()).map(([groupName, entries]) => (
        <div key={groupName}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{groupName}</p>
          <div className="flex flex-col gap-0.5 pl-3">
            {entries.map((e) => (
              <div key={e.ledgerId} className="rounded px-3 py-2 transition-colors hover:bg-surface-muted/40">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-text-secondary max-w-[250px] truncate" title={e.ledgerName}>{e.ledgerName}</span>
                  <span className="text-foreground">{money(e.net)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
