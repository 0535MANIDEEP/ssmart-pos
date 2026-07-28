"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney, formatDate } from "@/lib/format";

interface JournalLine {
  id: number;
  ledgerId: number;
  debit: number;
  credit: number;
  taxType: string | null;
  taxAmount: number;
  ledger: { id: number; name: string };
}

interface Journal {
  id: number;
  voucherNumber: string;
  date: string;
  type: string;
  narration: string | null;
  referenceType: string | null;
  referenceId: number | null;
  totalDebit: number;
  totalCredit: number;
  createdBy: number;
  lines: JournalLine[];
}

const JOURNAL_TYPES = ["", "journal", "payment", "receipt", "contra", "credit_note", "debit_note", "sales", "purchase"];

export default function JournalPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (typeFilter) params.set("type", typeFilter);
        params.set("limit", "500");
        const data = await api.get<Journal[]>(`/accounting/journals?${params.toString()}`);
        setJournals(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [startDate, endDate, typeFilter]);

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={FileText} title="Journal Entries" subtitle="All accounting journal entries with line details." />

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
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-text-secondary">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded border border-border bg-surface-muted px-3 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            >
              <option value="">All types</option>
              {JOURNAL_TYPES.filter(Boolean).map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
        ) : journals.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/50">No journal entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 w-8"></th>
                  <th className="pb-3 pr-4 text-left font-semibold">Date</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Type</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Voucher #</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Narration</th>
                  <th className="pb-3 text-right font-semibold">Debit</th>
                  <th className="pb-3 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {journals.map((j) => (
                  <JournalRow
                    key={j.id}
                    journal={j}
                    expanded={expandedId === j.id}
                    onToggle={() => toggleExpand(j.id)}
                    money={money}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function JournalRow({
  journal,
  expanded,
  onToggle,
  money,
}: {
  journal: Journal;
  expanded: boolean;
  onToggle: () => void;
  money: (n: number) => string;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/30 transition-colors hover:bg-surface-muted/40"
        onClick={onToggle}
      >
        <td className="py-2.5 pr-4">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-foreground/40" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 text-foreground/40" aria-hidden="true" />
          )}
        </td>
        <td className="py-2.5 pr-4 text-foreground/70">{formatDate(journal.date)}</td>
        <td className="py-2.5 pr-4">
          <span className="inline-flex items-center rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary capitalize">
            {journal.type.replace("_", " ")}
          </span>
        </td>
        <td className="py-2.5 pr-4 font-medium text-brand">{journal.voucherNumber}</td>
        <td className="py-2.5 pr-4 text-foreground/70 max-w-[200px] truncate" title={journal.narration || ""}>{journal.narration || "\u2014"}</td>
        <td className="py-2.5 text-right text-foreground/70">{money(journal.totalDebit)}</td>
        <td className="py-2.5 text-right text-foreground/70">{money(journal.totalCredit)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-8 pb-3">
            <div className="rounded border border-border p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-secondary uppercase">
                    <th className="py-1 pr-4 text-left font-semibold">Ledger</th>
                    <th className="py-1 text-right font-semibold">Debit</th>
                    <th className="py-1 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {journal.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                      <td className="py-1.5 pr-4 text-foreground/70">{line.ledger.name}</td>
                      <td className="py-1.5 text-right text-foreground/70">{line.debit > 0 ? money(line.debit) : ""}</td>
                      <td className="py-1.5 text-right text-foreground/70">{line.credit > 0 ? money(line.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
