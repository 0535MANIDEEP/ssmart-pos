"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Factory, Play, Pencil, X, Box, Package, Scale, Package2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { BillOfMaterial, Product } from "@/lib/types";

interface PackingLine {
  productId: number;
  quantity: number;
  rateTier: "A" | "B" | "C" | "";
  customPrice?: number;
}

interface BulkRecipe {
  id: number;
  name: string;
  parentProduct: Product;
  createdAt: string;
}

export default function PackingPage() {
  const { show } = useToast();
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [bulkProducts, setBulkProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<{ recipe: any; bulk: Product } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BillOfMaterial | null>(null);

  // Produce dialog for bulk production
  const [produceTarget, setProduceTarget] = useState<{ recipe: any; bulk: Product | null } | null>(null);
  const [produceQty, setProduceQty] = useState(1);

  // Recipe form - using string for productId to handle empty state
  const [recipeName, setRecipeName] = useState("");
  const [bulkProductId, setBulkProductId] = useState("");
  const [outputQty, setOutputQty] = useState(1);
  const [lines, setLines] = useState<PackingLine[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [bomsData, bulkData, allProducts] = await Promise.all([
        api.get<BillOfMaterial[]>("/suppliers/bom/all"),
        api.get<Product[]>("/products?isBulk=true"),
        api.get<Product[]>("/products"),
      ]);
      setBoms(bomsData);
      setBulkProducts(bulkData);
      setAllProducts(allProducts);
    } catch {
      show("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { productId: 0, quantity: 1, rateTier: "" }]);
  }

  function updateLine(idx: number, field: keyof PackingLine, value: any) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function getEffectivePrice(product: Product, tier: "A" | "B" | "C" | ""): number {
    const tierPrice = tier === "A" ? product.rateA : tier === "B" ? product.rateB : tier === "C" ? product.rateC : product.sellingPrice;
    const price = tierPrice != null && tierPrice > 0 ? tierPrice : product.sellingPrice;
    const stockDiscount = product.discountType === "percent" ? price * (product.discountValue / 100) : product.discountType === "amount" ? Math.min(product.discountValue, price) : 0;
    return price - stockDiscount;
  }

  const totalCost = lines.reduce((s, l) => {
    const p = allProducts.find((x) => x.id === l.productId);
    return s + (p?.purchasePrice ?? 0) * l.quantity;
  }, 0);

  const outputProduct = allProducts.find((p) => p.id === (editRecipe ? editRecipe.bulk.id : bulkProductId ? Number(bulkProductId) : 0));

  function openEdit(recipeId: number) {
    const bom = boms.find((b) => b.id === recipeId);
    if (!bom) return;
    const bulk = bulkProducts.find((p) => p.id === bom.outputProductId);
    if (!bulk) return;
    setEditRecipe({ recipe: bom, bulk });
    setRecipeName(bom.name);
    setBulkProductId(bom.outputProductId.toString());
    setOutputQty(bom.outputQuantity);
    setLines(bom.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      rateTier: "B",
    })));
    setShowForm(true);
  }

  function openCreate() {
    setEditRecipe(null);
    setRecipeName("");
    setBulkProductId("");
    setOutputQty(1);
    setLines([]);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipeName.trim()) return show("Give this recipe a name", "error");
    if (!bulkProductId) return show("Select bulk product", "error");
    if (lines.length === 0) return show("Add at least one ingredient", "error");
    if (lines.some((l) => !l.productId || l.quantity <= 0)) return show("Fill all ingredient details", "error");

    setSaving(true);
    try {
      const payload = {
        name: recipeName,
        description: `Packing recipe from ${outputProduct?.name || "bulk"} to ${outputProduct?.name || "pack"}`, // using bulk product as output for simplicity
        outputProductId: Number(bulkProductId),
        outputQuantity: outputQty,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          cost: allProducts.find(p => p.id === l.productId)?.purchasePrice || 0,
          rateTier: l.rateTier || null,
        })),
      };

      if (editRecipe) {
        await api.put(`/suppliers/bom/${editRecipe.recipe.id}`, payload);
        show("Packing recipe updated", "success");
      } else {
        await api.post("/suppliers/bom", payload);
        show("Packing recipe created", "success");
      }

      setShowForm(false);
      resetForm();
      loadAll();
    } catch (err) {
      show(describeApiError(err, "Failed to save recipe"), "error");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setRecipeName("");
    setBulkProductId("");
    setOutputQty(1);
    setLines([]);
    setEditRecipe(null);
  }

  async function produceRecipe(recipeId: number, qty: number) {
    setProduceTarget(null);
    try {
      await api.post(`/suppliers/bom/${recipeId}/produce`, { quantity: qty });
      show(`Produced ${qty} packs — ingredients deducted`, "success");
      loadAll();
    } catch (err) {
      show(describeApiError(err, "Production failed"), "error");
    }
  }

  function getProductUnit(productId: number): string {
    const p = allProducts.find(x => x.id === productId);
    return p?.unit || "units";
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Factory}
        title="Packing Recipes"
        subtitle={`${boms.length} packing recipes for bulk products`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Packing Recipe</Button>}
      />

      <div className="relative">
        <input
          type="text"
          placeholder="Search recipes by name or product..."
          className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-text-tertiary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
        />
        <Factory className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-text-tertiary">Loading packing recipes...</p>
        </div>
      ) : boms.length === 0 ? (
        <div className="py-16 text-center">
          <Package2 className="mx-auto mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-sm font-medium text-foreground">No packing recipes yet</p>
          <p className="text-xs text-text-tertiary mt-1">Create packing recipes to turn bulk into packaged products</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boms.map((bom) => {
            const bulk = bulkProducts.find(p => p.id === bom.outputProductId);
            const packOutput = allProducts.find(p => p.id === bom.outputProductId);
            return (
              <Card key={bom.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground mb-1">{bom.name}</h3>
                    <p className="text-xs text-text-secondary">From: {bulk?.name} ({bulk?.stock} stock)</p>
                    <p className="text-xs text-text-secondary">Output: {bom.outputQuantity} {packOutput?.unit || "units"}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(bom.id)}
                      className="text-text-secondary hover:text-brand p-1" title="Edit recipe"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(bom)}
                      className="text-text-secondary hover:text-danger p-1" title="Delete recipe"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-xs text-text-secondary">Ingredients:</p>
                  {bom.items.slice(0, 3).map((item, i) => {
                    const product = allProducts.find(p => p.id === item.productId);
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary truncate max-w-[120px]">{product?.name}</span>
                        <span className="text-foreground/60">× {item.quantity}</span>
                      </div>
                    );
                  })}
                  {bom.items.length > 3 && (
                    <div className="text-xs text-text-tertiary">+ {bom.items.length - 3} more</div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-text-secondary">Total cost: {formatMoney(totalCost)}</p>
                  <p className="text-xs text-text-secondary">Yield: {formatMoney(totalCost / bom.outputQuantity || 0)} per unit</p>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => { const bulk = bulkProducts.find(p => p.id === bom.outputProductId); const pack = allProducts.find(p => p.id === bom.outputProductId); setProduceTarget({ recipe: bom, bulk: bulk || pack || null }); }}
                >
                  <Play className="h-3.5 w-3.5" /> Produce {bom.outputQuantity} units
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Recipe Dialog */}
      {showForm && (
        <Dialog open onClose={() => setShowForm(false)} title={editRecipe ? "Edit Packing Recipe" : "Create Packing Recipe"}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              label="Recipe Name"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="e.g., Small Packets Recipe"
              required
            />
            <Select
              label="Bulk Product"
              value={bulkProductId}
              onChange={(e) => setBulkProductId(e.target.value)}
              options={bulkProducts.map(p => ({ value: p.id.toString(), label: `${p.name} (${p.stock} stock)` }))}
            />
            {outputProduct && (
              <div className="rounded-lg bg-brand/5 p-3 text-xs">
                <p className="font-medium text-brand mb-1">Bulk Info</p>
                <p className="text-foreground/60">Cost: {formatMoney(outputProduct.purchasePrice)} per {outputProduct.unit || "unit"}</p>
                <p className="text-foreground/60">MRP: {formatMoney(outputProduct.mrp || outputProduct.sellingPrice)}</p>
                {outputProduct.rateA && (<p className="text-success">Wholesale Rate: {formatMoney(outputProduct.rateA)}</p>)}
                {outputProduct.rateB && (<p className="text-success">Retail Rate: {formatMoney(outputProduct.rateB)}</p>)}
                {outputProduct.rateC && (<p className="text-success">Special Rate: {formatMoney(outputProduct.rateC)}</p>)}
              </div>
            )}
            <Field
              label="Output Quantity per Pack"
              type="number"
              min={1}
              value={outputQty}
              onChange={(e) => setOutputQty(Number(e.target.value))}
              placeholder="1"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">Ingredients</p>
                <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5" /> Add Ingredient
                </Button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Select
                      value={line.productId || ""}
                      onChange={(e) => updateLine(idx, "productId", Number(e.target.value))}
                      options={allProducts.map(p => ({ value: p.id.toString(), label: p.name }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Field
                      label="Qty"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={line.rateTier || ""}
                      onChange={(e) => updateLine(idx, "rateTier", e.target.value as "A" | "B" | "C" | "")}
                      options={[
                        { value: "", label: "MRP" },
                        { value: "A", label: "Wholesale" },
                        { value: "B", label: "Retail" },
                        { value: "C", label: "Special" },
                      ]}
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-text-secondary hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : editRecipe ? "Update Recipe" : "Create Recipe"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Produce Dialog */}
      {produceTarget && (
        <Dialog open onClose={() => setProduceTarget(null)} title="Produce Packs">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground/70">
              Produce packs using the {produceTarget.recipe.name} recipe from bulk product <strong>{produceTarget.bulk?.name}</strong>
            </p>
            <Field
              label="Quantity to Produce"
              type="number"
              min={1}
              value={produceQty}
              onChange={(e) => setProduceQty(Number(e.target.value))}
              placeholder="1"
            />
            <div className="rounded-lg bg-brand-light p-3 text-xs">
              <p className="font-medium text-brand mb-1">Material Requirements</p>
              {produceTarget.recipe.items.map((item: any) => {
                const product = allProducts.find(p => p.id === item.productId);
                return (
                  <div key={item.productId} className="flex justify-between">
                    <span className="text-foreground/70">{product?.name}</span>
                    <span className="text-foreground">× {item.quantity * produceQty} ({getProductUnit(item.productId)})</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => produceRecipe(produceTarget.recipe.id, produceQty)}>
                <Play className="h-4 w-4" /> Produce
              </Button>
              <Button variant="secondary" onClick={() => setProduceTarget(null)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} title="Delete Recipe?">
          <p className="text-sm text-foreground/70">
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="danger" onClick={async () => {
              try {
                await api.delete(`/suppliers/bom/${deleteTarget.id}`);
                show("Recipe deleted", "success");
                setDeleteTarget(null);
                loadAll();
              } catch (err) {
                show(describeApiError(err, "Failed to delete"), "error");
              }
            } }>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
