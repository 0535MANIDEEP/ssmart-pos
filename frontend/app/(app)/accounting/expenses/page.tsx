"use client";

import { useEffect, useState } from "react";
import { Plus, X, Receipt, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney, formatDate } from "@/lib/format";

interface Ledger {
  id: number;
  name: string;
  group: { id: number; name: string; code: string; reportType: string };
}

interface Expense {
  id: number;
  date: string;
  ledgerId: number;
  amount: number;
  paymentMode: string;
  bankLedgerId: number | null;
  reference: string | null;
  narration: string | null;
  partyName: string | null;
  createdBy: number;
  ledger: { id: number; name: string };
}

const SELECT_CLASS = "h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20";

export default function ExpensesPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    ledgerId: "",
    amount: "",
    paymentMode: "cash",
    narration: "",
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const [e, l] = await Promise.all([
        api.get<Expense[]>(`/accounting/expenses?${params.toString()}`),
        api.get<Ledger[]>("/accounting/ledgers"),
      ]);
      setExpenses(e);
      setLedgers(l);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const expenseLedgers = ledgers.filter((l) => l.group.reportType === 'profit_loss');

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/accounting/expenses", {
        date: form.date,
        ledgerId: Number(form.ledgerId),
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        narration: form.narration || null,
      });
      setShowForm(false);
      setForm({ date: new Date().toISOString().split("T")[0], ledgerId: "", amount: "", paymentMode: "cash", narration: "" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Receipt}
        title="Expenses"
        subtitle="Record and track business expenses."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Expense
          </Button>
        }
      />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {showForm && (
        <Card variant="elevated" className="p-6">
          <form onSubmit={createExpense} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Expense Ledger</label>
              <select
                value={form.ledgerId}
                onChange={(e) => setForm((f) => ({ ...f, ledgerId: e.target.value }))}
                className={SELECT_CLASS}
                required
              >
                <option value="">Select ledger…</option>
                {expenseLedgers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <Field
              label="Amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Payment Mode</label>
              <select
                value={form.paymentMode}
                onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                className={SELECT_CLASS}
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Narration (optional)</label>
              <input
                type="text"
                value={form.narration}
                onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
                placeholder="e.g. Office rent for July"
                className="rounded-xl border border-border bg-surface-muted/50 px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:bg-white hover:border-border-strong placeholder:text-text-tertiary"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Expense"}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </form>
        </Card>
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="mb-3 h-10 w-10 text-text-tertiary" />
            <p className="text-sm text-text-secondary">No expenses found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Date</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Ledger</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Payment</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Narration</th>
                  <th className="pb-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 text-foreground/70">{formatDate(exp.date)}</td>
                    <td className="py-2.5 pr-4 font-medium text-foreground">{exp.ledger.name}</td>
                    <td className="py-2.5 pr-4 text-foreground/70 capitalize">{exp.paymentMode}</td>
                    <td className="py-2.5 pr-4 text-foreground/70 max-w-[200px] truncate" title={exp.narration || ""}>{exp.narration || "\u2014"}</td>
                    <td className="py-2.5 text-right font-medium text-foreground">{money(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-muted/30 font-bold">
                  <td className="py-3 pr-4" colSpan={4}>Total</td>
                  <td className="py-3 text-right">{money(expenses.reduce((s, e) => s + e.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
