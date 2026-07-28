"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Factory, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import type { BillOfMaterial, BomItem, Product } from "@/lib/types";

interface BomLine {
  productId: number;
  quantity: number;
  unit: string;
}

export default function BOMPage() {
  const { show } = useToast();
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [bomName, setBomName] = useState("");
  const [bomDesc, setBomDesc] = useState("");
  const [outputProductId, setOutputProductId] = useState(0);
  const [outputQty, setOutputQty] = useState(1);
  const [lines, setLines] = useState<BomLine[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [b, p] = await Promise.all([
        api.get<BillOfMaterial[]>("/suppliers/bom/all"),
        api.get<Product[]>("/products"),
      ]);
      setBoms(b);
      setProducts(p);
    } catch {
      show("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { productId: 0, quantity: 1, unit: "KGS" }]);
  }

  function updateLine(idx: number, field: keyof BomLine, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bomName.trim()) return show("BOM name is required", "error");
    if (!outputProductId) return show("Select output product", "error");
    if (lines.length === 0) return show("Add at least one ingredient", "error");
    if (lines.some((l) => !l.productId || l.quantity <= 0)) return show("Fill all ingredient details", "error");

    setSaving(true);
    try {
      await api.post("/suppliers/bom", {
        name: bomName,
        description: bomDesc,
        outputProductId,
        outputQuantity: outputQty,
        items: lines,
      });
      show("BOM created", "success");
      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to create BOM", "error");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setBomName("");
    setBomDesc("");
    setOutputProductId(0);
    setOutputQty(1);
    setLines([]);
  }

  async function produceBOM(bom: BillOfMaterial) {
    const qty = prompt(`How many batches of "${bom.name}" to produce?`, "1");
    if (!qty) return;
    try {
      const result = await api.post<{ message: string }>(`/suppliers/bom/${bom.id}/produce`, { quantity: Number(qty) });
      show(result.message, "success");
      loadAll();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Production failed", "error");
    }
  }

  async function deleteBOM(bom: BillOfMaterial) {
    if (!confirm(`Delete BOM "${bom.name}"?`)) return;
    try {
      await api.delete(`/suppliers/bom/${bom.id}`);
      show("BOM deleted", "success");
      loadAll();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Failed to delete", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Factory}
        title="Bill of Materials"
        subtitle="Define packing recipes — bulk to packed conversion"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>New BOM</Button>}
      />

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-text-tertiary">Loading BOMs...</p>
        </div>
      ) : boms.length === 0 ? (
        <div className="py-16 text-center">
          <Factory className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm font-medium text-foreground">No BOMs defined</p>
          <p className="text-xs text-text-tertiary mt-1">Create a BOM to define how bulk items are packed into smaller units</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boms.map((bom) => (
            <Card key={bom.id} className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{bom.name}</h3>
                  {bom.description && <p className="text-xs text-text-tertiary mt-0.5">{bom.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => produceBOM(bom)} className="rounded p-1 text-text-tertiary hover:bg-success-light hover:text-success" title="Produce">
                    <Play className="h-4 w-4" />
                  </button>
                  <button onClick={() => deleteBOM(bom)} className="rounded p-1 text-text-tertiary hover:bg-danger-light hover:text-danger" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mb-2 rounded bg-brand-light px-2 py-1.5 text-xs">
                <span className="font-medium text-brand">Output:</span>{" "}
                <span className="text-foreground">{bom.outputProduct?.name} x {bom.outputQuantity}</span>
              </div>
              <div className="flex flex-col gap-1">
                {bom.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-text-secondary">{item.product?.name}</span>
                    <span className="font-medium text-foreground">{item.quantity} {item.unit || "units"}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New BOM Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Create Bill of Materials</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="BOM Name" value={bomName} onChange={(e) => setBomName(e.target.value)} placeholder="e.g. Rice 1kg Pack" required />
              <Field label="Description" value={bomDesc} onChange={(e) => setBomDesc(e.target.value)} placeholder="Optional description" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-foreground mb-1 block">Output Product (Packed)</label>
                  <select value={outputProductId} onChange={(e) => setOutputProductId(Number(e.target.value))} className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[13px]">
                    <option value={0}>Select product...</option>
                    {products.filter((p) => !p.isBulk).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>
                    ))}
                  </select>
                </div>
                <Field label="Output Quantity per Batch" type="number" min={1} value={outputQty} onChange={(e) => setOutputQty(Number(e.target.value))} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Ingredients (Bulk Items)</h3>
                  <Button type="button" variant="secondary" size="sm" onClick={addLine}>Add Ingredient</Button>
                </div>
                {lines.length === 0 ? (
                  <p className="py-4 text-center text-xs text-text-tertiary">Add ingredients needed to produce this pack</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex items-end gap-2 rounded-lg border border-border p-2">
                        <div className="flex-1">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Ingredient (Bulk Product)</label>
                          <select value={line.productId} onChange={(e) => updateLine(idx, "productId", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]">
                            <option value={0}>Select...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Quantity</label>
                          <input type="number" min={0.01} step={0.01} value={line.quantity} onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]" />
                        </div>
                        <div className="w-20">
                          <label className="text-[11px] text-text-secondary mb-0.5 block">Unit</label>
                          <select value={line.unit} onChange={(e) => updateLine(idx, "unit", e.target.value)} className="h-8 w-full rounded border border-border bg-surface-muted px-2 text-[12px]">
                            <option value="KGS">KGS</option>
                            <option value="LITRES">LITRES</option>
                            <option value="PCS">PCS</option>
                            <option value="GRAMS">GRAMS</option>
                          </select>
                        </div>
                        <button type="button" onClick={() => removeLine(idx)} className="rounded p-1 text-text-tertiary hover:text-danger pb-2">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create BOM"}</Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
