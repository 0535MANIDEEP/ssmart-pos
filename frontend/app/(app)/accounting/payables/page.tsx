"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface Payable {
  ledgerId: number;
  ledgerName: string;
  closingBalance: number;
}

export default function PayablesPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [data, setData] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await api.get<Payable[]>("/accounting/payables");
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const total = data.reduce((s, p) => s + p.closingBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={CreditCard} title="Accounts Payable" subtitle="Suppliers and vendors your business owes money to." />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <Card className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-text-tertiary">
            <CreditCard className="h-10 w-10" />
            <p className="text-[13px]">No payables found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Supplier / Ledger</th>
                  <th className="pb-3 text-right font-semibold">Amount Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((p) => (
                  <tr key={p.ledgerId} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{p.ledgerName}</td>
                    <td className="py-2.5 text-right font-medium text-danger">{money(p.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/30 font-bold">
                  <td className="py-3 pr-4">Total Payables</td>
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
