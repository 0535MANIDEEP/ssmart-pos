"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";

interface CostCenter {
  id: number;
  name: string;
  code: string | null;
}

export default function CostCentersPage() {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<CostCenter[]>("/accounting/cost-centers");
      setCenters(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(c: CostCenter) {
    setEditId(c.id);
    setName(c.name);
    setCode(c.code || "");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startCreate() {
    setEditId(null);
    setName("");
    setCode("");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (editId) {
        await api.put(`/accounting/cost-centers/${editId}`, { name, code: code || null });
        setSuccess("Cost center updated");
      } else {
        await api.post("/accounting/cost-centers", { name, code: code || null });
        setSuccess("Cost center created");
      }
      setShowForm(false);
      setEditId(null);
      setName("");
      setCode("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this cost center?")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/accounting/cost-centers/${id}`);
      setSuccess("Cost center deleted");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Building2}
        title="Cost Centers"
        subtitle="Manage cost centres for expense tracking."
        action={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Cost Center
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
              required
            />
            <Field
              label="Code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CC001"
            />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editId ? "Update" : "Create"}
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
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
          </div>
        ) : centers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Building2 className="h-8 w-8 text-text-tertiary" />
            <p className="text-[13px] text-text-secondary">No cost centers found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="pb-3 pr-4 text-left font-semibold">Code</th>
                  <th className="pb-3 pr-4 text-left font-semibold">Name</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((c) => (
                  <tr key={c.id} className="border-b border-border/30 transition-colors hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-4 font-mono text-xs text-foreground/70">{c.code || "—"}</td>
                    <td className="py-2.5 pr-4 font-medium text-foreground">{c.name}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded p-1 text-foreground/40 transition-colors hover:bg-surface-muted hover:text-brand"
                          aria-label={`Edit ${c.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="rounded p-1 text-foreground/40 transition-colors hover:bg-surface-muted hover:text-danger"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
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
