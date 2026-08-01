"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import type { Salesman } from "@/lib/types";

export default function SalesmenPage() {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Salesman | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Salesman | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCode, setFormCode] = useState("");
  const { show } = useToast();
  const qc = useQueryClient();

  const { data: salesmen = [], isLoading } = useQuery<Salesman[]>({
    queryKey: ["salesmen"],
    queryFn: () => api.get<Salesman[]>("/salesmen"),
  });

  const createMut = useMutation({
    mutationFn: async () => { await api.post("/salesmen", { name: formName, phone: formPhone, code: formCode }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salesmen"] }); setShowForm(false); resetForm(); show("Salesman added", "success"); },
    onError: (e: any) => show(e?.response?.data?.error || "Failed", "error"),
  });

  const updateMut = useMutation({
    mutationFn: async () => { if (editTarget) await api.put(`/salesmen/${editTarget.id}`, { name: formName, phone: formPhone, code: formCode }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salesmen"] }); setEditTarget(null); resetForm(); show("Salesman updated", "success"); },
    onError: (e: any) => show(e?.response?.data?.error || "Failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => { if (deleteTarget) await api.delete(`/salesmen/${deleteTarget.id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salesmen"] }); setDeleteTarget(null); show("Salesman deleted", "success"); },
    onError: (e: any) => show(e?.response?.data?.error || "Failed", "error"),
  });

  function resetForm() { setFormName(""); setFormPhone(""); setFormCode(""); }

  function openEdit(s: Salesman) { setFormName(s.name); setFormPhone(s.phone || ""); setFormCode(s.code); setEditTarget(s); }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Salesmen</h1>
        <Button variant="primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Add Salesman
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Code</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Name</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/70">Status</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesmen.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                  <td className="px-4 py-3 font-mono text-xs text-foreground/70">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-foreground/70">{s.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? "bg-success/10 text-success" : "bg-foreground/10 text-foreground/50"}`}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="mr-2 text-foreground/50 hover:text-brand"><Pencil className="h-4 w-4 inline" /></button>
                    <button onClick={() => setDeleteTarget(s)} className="text-foreground/50 hover:text-danger"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>
              ))}
              {salesmen.length === 0 && !isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground/50">No salesmen yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit dialog */}
      {(showForm || editTarget) && (
        <Dialog open onClose={() => { setShowForm(false); setEditTarget(null); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">{editTarget ? "Edit Salesman" : "Add Salesman"}</h2>
            <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="text-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); editTarget ? updateMut.mutate() : createMut.mutate(); }}>
            <Field label="Name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            <Field label="Code" value={formCode} onChange={(e) => setFormCode(e.target.value)} required placeholder="e.g. S001" />
            <Field label="Phone (optional)" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
            <div className="flex gap-3 mt-2">
              <Button type="submit" variant="primary" disabled={createMut.isPending || updateMut.isPending}>
                {editTarget ? "Update" : "Add"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditTarget(null); }}>Cancel</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)}>
          <h2 className="text-lg font-bold text-foreground mb-2">Delete Salesman?</h2>
          <p className="text-sm text-foreground/70 mb-4">This will permanently remove <strong>{deleteTarget.name}</strong>.</p>
          <div className="flex gap-3">
            <Button variant="danger" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
