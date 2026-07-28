"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface Receivable {
  ledgerId: number;
  ledgerName: string;
  closingBalance: number;
}

export default function ReceivablesPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [data, setData] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await api.get<Receivable[]>("/accounting/receivables");
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = data.reduce((s, r) => s + r.closingBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={CircleDollarSign} title="Accounts Receivable" subtitle="Customers who owe money to your business." />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <Card className="p-5">
        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-text-tertiary">Loading receivables…</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-16 text-center">
            <CircleDollarSign className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
            <p className="text-[13px] text-text-secondary">No receivables found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Customer / Ledger</th>
                  <th className="pb-3 text-right font-semibold">Amount Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r) => (
                  <tr key={r.ledgerId} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{r.ledgerName}</td>
                    <td className="py-2.5 text-right font-medium text-danger">{money(r.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/30 font-bold">
                  <td className="py-3 pr-4">Total Receivables</td>
                  <td className="py-3 text-right">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
