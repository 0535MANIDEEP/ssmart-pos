"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Phone, MapPin, Building2, Users, Search, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Supplier } from "@/lib/types";

const EMPTY_FORM = {
  name: "",
  gstin: "",
  phone: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  pincode: "",
  contactPerson: "",
  paymentTerms: "",
};

export default function SuppliersPage() {
  const { show } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      const data = await api.get<Supplier[]>("/suppliers");
      setSuppliers(data);
    } catch {
      show("Failed to load suppliers", "error");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      gstin: s.gstin || "",
      phone: s.phone || "",
      email: s.email || "",
      address1: s.address1 || "",
      address2: s.address2 || "",
      city: s.city || "",
      state: s.state || "",
      pincode: s.pincode || "",
      contactPerson: s.contactPerson || "",
      paymentTerms: s.paymentTerms || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return show("Supplier name is required", "error");
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, form);
        show("Supplier updated", "success");
      } else {
        await api.post("/suppliers", form);
        show("Supplier created", "success");
      }
      setShowForm(false);
      loadSuppliers();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to save supplier", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      const result = await api.delete<{ message: string }>(`/suppliers/${s.id}`);
      show(result.message, "success");
      loadSuppliers();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to delete", "error");
    }
  }

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.toLowerCase().includes(search.toLowerCase()) ||
      s.gstin?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="Suppliers"
        subtitle={`${suppliers.length} registered suppliers`}
        action={<Button onClick={openAdd}>Add Supplier</Button>}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-text-tertiary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-text-tertiary">Loading suppliers...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm font-medium text-foreground">{search ? "No matching suppliers" : "No suppliers yet"}</p>
          <p className="text-xs text-text-tertiary mt-1">{search ? "Try a different search" : "Add your first supplier to start tracking purchases"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>GSTIN</th>
                <th>City</th>
                <th>Outstanding</th>
                <th>Purchases</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>
                      <p className="font-medium text-foreground">{s.name}</p>
                      {s.contactPerson && <p className="text-xs text-text-tertiary">{s.contactPerson}</p>}
                    </div>
                  </td>
                  <td className="text-text-secondary">
                    <div className="flex flex-col">
                      {s.phone && <span>{s.phone}</span>}
                      {s.email && <span className="text-xs text-text-tertiary">{s.email}</span>}
                    </div>
                  </td>
                  <td className="font-mono text-xs text-text-secondary">{s.gstin || "—"}</td>
                  <td className="text-text-secondary">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>
                    <span className={s.outstandingBalance > 0 ? "font-semibold text-danger" : "text-success"}>
                      {s.outstandingBalance > 0 ? `₹${s.outstandingBalance.toFixed(2)}` : "settled"}
                    </span>
                  </td>
                  <td className="text-text-secondary">{s._count?.purchaseInvoices ?? 0}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(s)} className="rounded p-1 text-text-tertiary hover:bg-surface-muted hover:text-brand" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="rounded p-1 text-text-tertiary hover:bg-danger-light hover:text-danger" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit Supplier" : "Add Supplier"}</h2>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-text-tertiary hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="Supplier Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <Field label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="15-character GSTIN" />
              <Field label="Contact Person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              <Field label="Address Line 1" value={form.address1} onChange={(e) => setForm({ ...form, address1: e.target.value })} />
              <Field label="Address Line 2" value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Field label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Field label="PIN Code" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
              <Field label="Payment Terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="e.g. Net 30, Cash" />
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
