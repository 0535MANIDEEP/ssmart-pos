"use client";

import { useEffect, useState } from "react";
import { Calculator, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface TrialBalanceEntry {
  ledgerId: number;
  ledgerName: string;
  groupName: string;
  debit: number;
  credit: number;
}

export default function TrialBalancePage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        const data = await api.get<TrialBalanceEntry[]>(`/accounting/trial-balance?${params.toString()}`);
        setEntries(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const inputClass =
    "h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Calculator}
        title="Trial Balance"
        subtitle="Verify that total debits equal total credits."
      />

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-text-tertiary">Loading trial balance…</p>
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "ledgerName", label: "Ledger" },
              { key: "groupName", label: "Group" },
              { key: "debit", label: "Debit", align: "right" },
              { key: "credit", label: "Credit", align: "right" },
            ]}
            data={entries}
            emptyMessage="No data found."
            emptyIcon={FileSpreadsheet}
            renderRow={(entry) => (
              <>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {entry.ledgerName}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {entry.groupName}
                </td>
                <td className="px-4 py-2.5 text-right text-text-secondary">
                  {entry.debit > 0 ? money(entry.debit) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-text-secondary">
                  {entry.credit > 0 ? money(entry.credit) : "—"}
                </td>
              </>
            )}
            renderFooter={() => (
              <>
                <td className="px-4 py-3" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-3 text-right">{money(totalDebit)}</td>
                <td className="px-4 py-3 text-right">{money(totalCredit)}</td>
              </>
            )}
          />
        )}

        {!loading && entries.length > 0 && (
          <div className="mt-4 flex items-center justify-end">
            <span
              className={
                balanced
                  ? "rounded bg-success/10 px-4 py-2 text-[12px] font-semibold text-success ring-1 ring-success/20"
                  : "rounded bg-danger/10 px-4 py-2 text-[12px] font-semibold text-danger ring-1 ring-danger/20"
              }
            >
              {balanced
                ? "Balanced"
                : `Difference: ${money(Math.abs(totalDebit - totalCredit))}`}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
