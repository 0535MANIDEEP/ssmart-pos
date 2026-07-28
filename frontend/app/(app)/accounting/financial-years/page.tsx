"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

interface FinancialYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
}

export default function FinancialYearsPage() {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<FinancialYear[]>("/accounting/financial-years");
      setYears(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/accounting/financial-years", { name, startDate, endDate });
      setSuccess("Financial year created");
      setShowForm(false);
      setName("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Calendar}
        title="Financial Years"
        subtitle="Manage financial year periods for reporting."
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Financial Year
          </Button>
        }
      />

      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>
      )}
      {success && (
        <p className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">{success}</p>
      )}

      {showForm && (
        <Card variant="elevated" className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2025-26"
              required
            />
            <Field
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Field
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create Financial Year"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
          </div>
        ) : years.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Calendar className="h-10 w-10 text-text-tertiary" />
            <p className="text-[13px] text-text-secondary">No financial years found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Name</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Start Date</th>
                  <th className="pb-3 pr-4 text-left font-semibold">End Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {years.map((fy) => (
                  <tr key={fy.id} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{fy.name}</td>
                    <td className="py-2.5 pr-4 text-foreground/70">{formatDate(fy.startDate)}</td>
                    <td className="py-2.5 pr-4 text-foreground/70">{formatDate(fy.endDate)}</td>
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
