"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";

interface Ledger {
  id: number;
  name: string;
  group: { id: number; name: string; code: string };
}

const JOURNAL_TYPES = [
  { value: "journal", label: "Journal" },
  { value: "payment", label: "Payment" },
  { value: "receipt", label: "Receipt" },
  { value: "contra", label: "Contra" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
];

interface LineForm {
  ledgerId: string;
  debit: string;
  credit: string;
}

export default function PaymentsPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState("journal");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<LineForm[]>([
    { ledgerId: "", debit: "", credit: "" },
    { ledgerId: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Ledger[]>("/accounting/ledgers");
        setLedgers(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load ledgers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateLine(index: number, field: keyof LineForm, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ledgerId: "", debit: "", credit: "" }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!balanced) {
      setError("Debit and credit totals must be equal and non-zero");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/accounting/journals", {
        date,
        type,
        narration: narration || null,
        lines: lines
          .filter((l) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            ledgerId: Number(l.ledgerId),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
      });
      setSuccess("Journal entry posted successfully");
      setLines([
        { ledgerId: "", debit: "", credit: "" },
        { ledgerId: "", debit: "", credit: "" },
      ]);
      setNarration("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post journal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={Wallet} title="Manual Journal Vouchers" subtitle="Create journal entries, payments, receipts and more." />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}
      {success && (
        <p className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">{success}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        </div>
      ) : (
        <Card variant="elevated" className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Voucher Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                >
                  {JOURNAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <Field
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <Field
                label="Narration (optional)"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Description of this entry"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    <th className="pb-3 pr-4 text-left font-semibold">Ledger</th>
                    <th className="pb-3 pr-4 text-left font-semibold w-36">Debit</th>
                    <th className="pb-3 pr-4 text-left font-semibold w-36">Credit</th>
                    <th className="pb-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                      <td className="py-2 pr-4">
                        <select
                          value={line.ledgerId}
                          onChange={(e) => updateLine(i, "ledgerId", e.target.value)}
                          className="h-9 w-full rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                          required
                        >
                          <option value="">Select ledger…</option>
                          {ledgers.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) => updateLine(i, "debit", e.target.value)}
                          placeholder="0"
                          className="h-9 w-full rounded border border-border bg-surface-muted px-3 text-[13px] text-right text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) => updateLine(i, "credit", e.target.value)}
                          placeholder="0"
                          className="h-9 w-full rounded border border-border bg-surface-muted px-3 text-[13px] text-right text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          disabled={lines.length <= 2}
                          className="text-foreground/40 hover:text-danger disabled:opacity-30"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-muted/30 font-bold">
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4 text-right">{money(totalDebit)}</td>
                    <td className="py-2 pr-4 text-right">{money(totalCredit)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={addLine}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add row
              </Button>
              <span
                className={`rounded px-4 py-2 text-[11px] font-semibold ring-1 ${
                  balanced
                    ? "bg-success/10 text-success ring-success/20"
                    : "bg-danger/10 text-danger ring-danger/20"
                }`}
              >
                {balanced ? "Balanced" : `Difference: ${money(Math.abs(totalDebit - totalCredit))}`}
              </span>
              <div className="ml-auto">
                <Button type="submit" disabled={submitting || !balanced}>
                  {submitting ? "Posting…" : "Post Entry"}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
