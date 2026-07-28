"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney, formatDate } from "@/lib/format";

interface BsEntry {
  ledgerId: number;
  ledgerName: string;
  groupName: string;
  debit: number;
  credit: number;
  net: number;
}

interface BalanceSheetData {
  assets: BsEntry[];
  liabilities: BsEntry[];
  capital: BsEntry[];
  totalAssets: number;
  totalLiabilities: number;
}

export default function BalanceSheetPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = asOf ? `?asOf=${asOf}` : "";
        const result = await api.get<BalanceSheetData>(`/accounting/balance-sheet${params}`);
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [asOf]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Scale} title="Balance Sheet" subtitle="Assets, liabilities and capital as of the selected date." />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">As of date</label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-foreground/50">No data found.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <BsSection title="Assets" entries={data.assets} total={data.totalAssets} money={money} />
            <BsSection title="Liabilities" entries={data.liabilities} total={data.totalLiabilities} money={money} />
            {data.capital.length > 0 && (
              <BsSection title="Capital" entries={data.capital} total={data.capital.reduce((s, e) => s + e.net, 0)} money={money} />
            )}

            <div className="flex items-center justify-between rounded border border-success/20 bg-success/5 p-4 text-[13px] font-bold shadow-sm">
              <span>Total Assets</span>
              <span>{money(data.totalAssets)}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-brand/20 bg-brand/5 p-4 text-[13px] font-bold shadow-sm">
              <span>Total Liabilities + Capital</span>
              <span>{money(data.totalLiabilities + data.capital.reduce((s, e) => s + e.net, 0))}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BsSection({
  title,
  entries,
  total,
  money,
}: {
  title: string;
  entries: BsEntry[];
  total: number;
  money: (n: number) => string;
}) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-brand">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-foreground/50">No entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <th className="pb-3 pr-4 text-left font-semibold">Ledger</th>
                <th className="pb-3 pr-4 text-left font-semibold">Group</th>
                <th className="pb-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.ledgerId} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                  <td className="py-2 pr-4 font-medium text-foreground max-w-[200px] truncate" title={e.ledgerName}>{e.ledgerName}</td>
                  <td className="py-2 pr-4 text-text-secondary max-w-[150px] truncate" title={e.groupName}>{e.groupName}</td>
                  <td className="py-2 text-right text-foreground">{money(e.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-muted/30 font-bold">
                <td className="py-2 pr-4" colSpan={2}>Total {title}</td>
                <td className="py-2 text-right">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
