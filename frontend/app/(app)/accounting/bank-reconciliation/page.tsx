"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Landmark, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney, formatDate } from "@/lib/format";

interface UnreconciledEntry {
  id: number;
  journalId: number;
  statementDate: string | null;
  statementRef: string | null;
  reconciled: boolean;
  reconciledAt: string | null;
  amount: number;
  journal: {
    id: number;
    voucherNumber: string;
    date: string;
    type: string;
    narration: string | null;
    totalDebit: number;
    totalCredit: number;
  };
}

export default function BankReconciliationPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [items, setItems] = useState<UnreconciledEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [reconcilingId, setReconcilingId] = useState<number | null>(null);
  const [statementDate, setStatementDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [statementRef, setStatementRef] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<UnreconciledEntry[]>("/accounting/bank-reconciliation");
      setItems(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function reconcile(id: number) {
    setError("");
    setSuccess("");
    try {
      await api.post("/accounting/bank-reconciliation", {
        journalId: id,
        statementDate,
        statementRef: statementRef || null,
      });
      setSuccess("Journal entry reconciled");
      setReconcilingId(null);
      setStatementRef("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reconciliation failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Landmark} title="Bank Reconciliation" subtitle="Match journal entries against bank statements." />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}
      {success && (
        <p className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">{success}</p>
      )}

      <Card className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Landmark className="h-8 w-8 text-text-secondary" />
            <p className="text-sm text-text-secondary">No unreconciled entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Date</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Voucher #</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Type</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Narration</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Amount</th>
                  <th className="pb-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 text-foreground/70">{formatDate(item.journal.date)}</td>
                    <td className="py-2.5 pr-4 font-medium text-brand">{item.journal.voucherNumber}</td>
                    <td className="py-2.5 pr-4 text-foreground/70 capitalize">{item.journal.type.replace("_", " ")}</td>
                    <td className="py-2.5 pr-4 text-foreground/70 max-w-[200px] truncate" title={item.journal.narration || ""}>{item.journal.narration || "\u2014"}</td>
                    <td className="py-2.5 pr-4 text-foreground/70">{money(item.journal.totalDebit)}</td>
                    <td className="py-2.5 text-right">
                      {reconcilingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={statementDate}
                            onChange={(e) => setStatementDate(e.target.value)}
                            className="h-8 rounded border border-border bg-surface-muted px-2 text-[12px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                          />
                          <input
                            type="text"
                            value={statementRef}
                            onChange={(e) => setStatementRef(e.target.value)}
                            placeholder="Ref #"
                            className="h-8 w-28 rounded border border-border bg-surface-muted px-2 text-[12px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                          />
                          <Button variant="ghost" onClick={() => reconcile(item.id)} className="!px-2 !py-1 !text-xs">
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" onClick={() => setReconcilingId(item.id)} className="!px-2 !py-1 !text-xs">
                          Reconcile
                        </Button>
                      )}
                    </td>
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
