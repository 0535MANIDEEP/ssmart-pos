"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Minus, Plus, Trash2, Printer, Tag, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useShopSettings } from "@/hooks/useShopSettings";
import type { Product, Packing } from "@/lib/types";

export default function PackingPage() {
  const { data: shop } = useShopSettings();
  const { show } = useToast();
  const qc = useQueryClient();
  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPackDialog, setShowPackDialog] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [selectedBulk, setSelectedBulk] = useState<Product | null>(null);
  const [selectedPacking, setSelectedPacking] = useState<Packing | null>(null);

  const [formBulkId, setFormBulkId] = useState<number>(0);
  const [formPackProductId, setFormPackProductId] = useState<number>(0);
  const [formPackWeight, setFormPackWeight] = useState<number>(500);
  const [formPackLabel, setFormPackLabel] = useState("");
  const [formMrp, setFormMrp] = useState<number>(0);
  const [formSellingPrice, setFormSellingPrice] = useState<number>(0);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: bulkProducts = [], isLoading: loadingBulks } = useQuery<Product[]>({
    queryKey: ["bulk-products"],
    queryFn: () => api.get<Product[]>("/products?bulk=1"),
    enabled: true,
  });

  const { data: packings = [], isLoading: loadingPackings } = useQuery<Packing[]>({
    queryKey: ["packings"],
    queryFn: () => api.get<Packing[]>("/packing"),
    enabled: true,
  });

  const eligiblePackProducts = useMemo(
    () => bulkProducts.filter((b) => !b.isBulk && b.bulkProductId === formBulkId),
    [bulkProducts, formBulkId]
  );

  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!formBulkId) errs.bulkProduct = "Select a bulk product";
    if (!formPackProductId) errs.packProduct = "Select a pack product variant";
    if (formPackWeight <= 0) errs.packWeight = "Weight must be greater than 0";
    if (formPackWeight > 50000) errs.packWeight = "Weight cannot exceed 50 kg";
    if (!formPackLabel.trim()) errs.packLabel = "Label is required (e.g. 500 g)";
    if (formMrp <= 0) errs.mrp = "MRP must be greater than 0";
    if (formSellingPrice <= 0) errs.sellingPrice = "Our Price must be greater than 0";
    if (formMrp > 0 && formSellingPrice > 0 && formSellingPrice > formMrp) {
      errs.sellingPrice = "Our Price cannot be higher than MRP";
    }
    if (formMrp > 0 && formSellingPrice > 0 && Math.round(formMrp * 100) === Math.round(formSellingPrice * 100)) {
      errs.sellingPrice = "Our Price should be lower than MRP to offer a discount";
    }
    return errs;
  }, [formBulkId, formPackProductId, formPackWeight, formPackLabel, formMrp, formSellingPrice]);

  const hasFormErrors = Object.keys(validationErrors).length > 0;

  const createPacking = useMutation({
    mutationFn: async () => {
      const errs = validationErrors;
      if (Object.keys(errs).length > 0) throw new Error("Please fix the form errors before creating");
      const bulk = bulkProducts.find((b) => b.id === formBulkId);
      const bulkCostPerGram = bulk && bulk.purchasePrice > 0 && bulk.packSize && bulk.packSize > 0
        ? bulk.purchasePrice / (bulk.packSize * 1000)
        : 0;
      const derivedPurchasePrice = bulkCostPerGram * formPackWeight;
      return api.post("/packing", {
        bulkProductId: formBulkId,
        packProductId: formPackProductId,
        packWeight: formPackWeight,
        packLabel: formPackLabel.trim(),
        mrp: formMrp,
        sellingPrice: formSellingPrice,
        purchasePrice: Math.round(derivedPurchasePrice * 100) / 100,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packings"] });
      setShowCreateDialog(false);
      resetForm();
      show("Packing created successfully", "success");
    },
    onError: (e: any) => {
      if (e.message === "Please fix the form errors before creating") {
        setFormErrors(validationErrors);
        show("Please fix the highlighted errors", "error");
      } else {
        show(describeApiError(e, "Failed to create packing"), "error");
      }
    },
  });

  function resetForm() {
    setFormBulkId(0);
    setFormPackProductId(0);
    setFormPackWeight(500);
    setFormPackLabel("");
    setFormMrp(0);
    setFormSellingPrice(0);
    setFormErrors({});
  }

  function openCreate(bulk: Product) {
    setSelectedBulk(bulk);
    resetForm();
    setFormBulkId(bulk.id);
    setFormPackLabel(bulk.name);
    setShowCreateDialog(true);
  }

  function openPack(bulk: Product, packing: Packing) {
    setSelectedBulk(bulk);
    setSelectedPacking(packing);
    setShowPackDialog(true);
  }

  function openLabel(packing: Packing) {
    setSelectedPacking(packing);
    setShowLabelDialog(true);
  }

  async function doPack(packCount: number) {
    if (!selectedPacking) return;
    try {
      await api.post(`/packing/${selectedPacking.id}/create-packs`, {
        packCount,
        qtyPerPack: selectedPacking.packWeight,
      });
      show(`Packed ${packCount} units (${selectedPacking.packLabel} each)`, "success");
      setShowPackDialog(false);
      qc.invalidateQueries({ queryKey: ["packings"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      show(describeApiError(err, "Failed to create packs"), "error");
    }
  }

  async function removePacking(id: number) {
    try {
      await api.delete(`/packing/${id}`);
      qc.invalidateQueries({ queryKey: ["packings"] });
      show("Packing removed", "success");
    } catch (err) {
      show(describeApiError(err, "Failed to remove packing"), "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Packing</h1>
        <Button variant="primary" onClick={() => { resetForm(); setSelectedBulk(null); setShowCreateDialog(true); }}>
          <Package className="h-4 w-4" /> New Packing
        </Button>
      </div>

      {/* Packing List */}
      <Card className="overflow-hidden">
        {loadingPackings ? (
          <div className="py-8 text-center text-sm text-foreground/50">Loading packings\u2026</div>
        ) : packings.length === 0 ? (
          <div className="py-8 text-center text-sm text-foreground/50">No packings yet \u2014 create one to start packing bulk items</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-foreground/70">Bulk Item</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground/70">Pack Label</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground/70">Weight</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground/70">MRP</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground/70">Our Price</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground/70">Stock</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground/70">Actions</th>
                </tr>
              </thead>
              <tbody>
                {packings.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{p.bulkProduct?.name}</td>
                    <td className="px-4 py-3 text-foreground">{p.packLabel}</td>
                    <td className="px-4 py-3 text-foreground/70">{p.packWeight}g</td>
                    <td className="px-4 py-3 text-right text-foreground">{money(p.mrp)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{money(p.sellingPrice)}</td>
                    <td className="px-4 py-3 text-right text-foreground/70">{p.packProduct?.stock ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openLabel(p)} className="mr-2 text-foreground/50 hover:text-brand" title="Label preview"><Tag className="h-4 w-4 inline" /></button>
                      <button onClick={() => { const bulk = bulkProducts.find(b => b.id === p.bulkProductId); if (bulk) openPack(bulk, p); }} className="mr-2 text-foreground/50 hover:text-brand" title="Pack from bulk"><Package className="h-4 w-4 inline" /></button>
                      <button onClick={() => removePacking(p.id)} className="text-foreground/50 hover:text-danger" title="Remove packing"><Trash2 className="h-4 w-4 inline" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Packing Dialog */}
      {showCreateDialog && (
        <Dialog open onClose={() => setShowCreateDialog(false)} title="New Packing">
          <p className="text-[12px] text-foreground/50 mb-4">Link a bulk product to a pack variant and set prices</p>
          <div className="flex flex-col gap-4">
            <Select label="Bulk Product" helperText="The large unit you bought in bulk" error={formErrors.bulkProduct} value={formBulkId.toString()} onChange={(e) => { const val = Number(e.target.value); setFormBulkId(val); setFormPackProductId(0); const b = bulkProducts.find((b) => b.id === val); if (b) setFormPackLabel(b.name); }} options={[{ value: "0", label: "Select bulk product\u2026" }, ...bulkProducts.filter((b) => b.isBulk).map((b) => ({ value: b.id.toString(), label: `${b.name} (Stock: ${b.stock} ${b.unit || "kg"})` }))]} />
            <Select label="Pack Variant" helperText="The smaller unit customers buy (linked to selected bulk)" error={formErrors.packProduct} value={formPackProductId.toString()} onChange={(e) => setFormPackProductId(Number(e.target.value))} options={[{ value: "0", label: "Select pack variant\u2026" }, ...eligiblePackProducts.map((b) => ({ value: b.id.toString(), label: `${b.name} (${b.unit})` }))]} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pack Weight" helperText="Weight per pack unit in grams (e.g. 500)" type="number" min={1} step={1} error={formErrors.packWeight} value={formPackWeight} onChange={(e) => setFormPackWeight(Number(e.target.value))} />
              <Field label="Pack Label" helperText="Text shown on the label (e.g. 500 g)" error={formErrors.packLabel} value={formPackLabel} onChange={(e) => setFormPackLabel(e.target.value)} placeholder="e.g. 500 g" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="MRP" helperText="Maximum Retail Price printed on the label" type="number" min={0} step={0.01} error={formErrors.mrp} value={formMrp} onChange={(e) => setFormMrp(Number(e.target.value))} />
              <Field label="Our Price" helperText="Your actual selling price \u2014 must be lower than MRP" type="number" min={0} step={0.01} error={formErrors.sellingPrice} value={formSellingPrice} onChange={(e) => setFormSellingPrice(Number(e.target.value))} />
            </div>
            {formPackWeight > 0 && formBulkId > 0 && (
              <div className="rounded-lg bg-surface-muted p-3 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-foreground/40 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">Cost Price</p>
                  <p className="text-[11px] text-foreground/50 mt-0.5">Auto-calculated from bulk purchase cost per gram. Internal reference only \u2014 never shown to customers.</p>
                </div>
              </div>
            )}
            {hasFormErrors && (
              <p className="text-[12px] text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> Please fix the highlighted errors before creating</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={() => createPacking.mutate()} disabled={createPacking.isPending || hasFormErrors}>
                {createPacking.isPending ? "Creating\u2026" : "Create Packing"}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Pack Dialog */}
      {showPackDialog && selectedPacking && selectedBulk && (
        <Dialog open onClose={() => setShowPackDialog(false)} title="Pack Units">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-muted p-3 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-foreground/40 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-medium text-foreground">{selectedBulk.name} <span className="text-foreground/50">(Bulk)</span></p>
                <p className="text-[11px] text-foreground/60 mt-0.5">Stock: {selectedBulk.stock} {selectedBulk.unit || "kg"} \u00B7 Purchase: {money(selectedBulk.purchasePrice)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-success">{selectedPacking.packLabel}</span>
              <span className="text-xs text-foreground/50">Pack</span>
            </div>
            <div className="text-[12px] text-foreground/60">Pack Weight: {selectedPacking.packWeight}g \u00B7 MRP: {money(selectedPacking.mrp)} \u00B7 Our Price: {money(selectedPacking.sellingPrice)}</div>
            {selectedBulk.stock < selectedPacking.packWeight && (
              <p className="text-[12px] text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> Not enough bulk stock for even one pack</p>
            )}
            <PackCounter onPack={doPack} maxBulk={selectedBulk.stock} packWeight={selectedPacking.packWeight} />
          </div>
        </Dialog>
      )}

      {/* Label Preview Dialog */}
      {showLabelDialog && selectedPacking && (
        <Dialog open onClose={() => setShowLabelDialog(false)} title="Label Preview">
          <div className="rounded-lg border-2 border-dashed border-border p-6 bg-surface text-center max-w-xs mx-auto">
            <p className="text-[10px] text-foreground/40 uppercase tracking-widest mb-2">{shop?.shopName || "SS Mart"}</p>
            <p className="text-lg font-bold text-foreground">{selectedPacking.packLabel}</p>
            <p className="text-xs text-foreground/60 mt-1">{selectedPacking.bulkProduct?.name}</p>
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-[10px] text-foreground/50 uppercase tracking-wider">MRP</p>
              <p className="text-xl font-bold text-foreground">{money(selectedPacking.mrp)}</p>
              <p className="text-[10px] text-success font-semibold uppercase tracking-wider mt-3">Our Price</p>
              <p className="text-2xl font-extrabold text-success">{money(selectedPacking.sellingPrice)}</p>
            </div>
            {shop?.gstEnabled && (
              <p className="mt-2 text-[10px] text-foreground/40">GST {selectedPacking.taxRate}%</p>
            )}
          </div>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => {
            const lp = window.open("", "_blank");
            if (lp) {
              lp.document.write(`<html><head><title>Label</title><style>body{font-family:monospace;text-align:center;padding:20px;width:58mm;margin:0 auto}.shop{font-size:10px;color:#64748b}.name{font-size:16px;font-weight:bold;margin:4px 0}.weight{font-size:11px;color:#475569}.section{border-top:1px dashed #cbd5e1;margin-top:8px;padding-top:8px}.mrp{font-size:10px;color:#64748b}.our{font-size:22px;font-weight:bold;color:#16a34a}</style></head><body><p class="shop">${shop?.shopName || "SS Mart"}</p><p class="name">${selectedPacking.packLabel}</p><p class="weight">${selectedPacking.bulkProduct?.name}</p><div class="section"><p class="mrp">MRP: ${money(selectedPacking.mrp)}</p><p class="our">Our Price: ${money(selectedPacking.sellingPrice)}</p></div></body></html>`);
              lp.print();
              lp.close();
            }
          }}>
            <Printer className="h-4 w-4" /> Print Label
          </Button>
        </Dialog>
      )}
    </div>
  );
}

function PackCounter({ onPack, maxBulk, packWeight }: { onPack: (count: number) => void; maxBulk: number; packWeight: number }) {
  const [count, setCount] = useState(1);
  const maxPossible = Math.max(0, Math.floor(maxBulk / packWeight));
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [feedback, setFeedback] = useState<string | null>(null);

  function handlePack(count: number) {
    if (count < 1) { setFeedback("Please enter a valid number"); return; }
    if (count > maxPossible) { setFeedback(`Maximum ${maxPossible} pack(s) possible with available stock`); return; }
    onPack(count);
    setFeedback(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-foreground/60">How many packs to create? (Max: {maxPossible})</p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setCount((c) => Math.max(1, c - 1)); setQtyInput(String(Math.max(1, count - 1))); setFeedback(null); }} className="h-10 w-10 rounded-lg border border-border bg-surface hover:bg-surface-muted text-lg font-medium">\u2212</button>
        <input
          type="number"
          min={1}
          max={maxPossible}
          value={qtyInput}
          onChange={(e) => { setQtyInput(e.target.value); setCount(Math.max(1, Math.min(maxPossible, Number(e.target.value) || 0))); setFeedback(null); }}
          className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-center text-lg font-semibold text-foreground"
        />
        <button type="button" onClick={() => { setCount((c) => Math.min(maxPossible, c + 1)); setQtyInput(String(Math.min(maxPossible, count + 1))); setFeedback(null); }} className="h-10 w-10 rounded-lg border border-border bg-surface hover:bg-surface-muted text-lg font-medium">+</button>
      </div>
      <div className="text-[11px] text-foreground/50">
        Will use {Math.min(count, maxPossible) * packWeight}g of bulk stock \u2192 {Math.min(count, maxPossible)} pack(s) of {packWeight}g
      </div>
      {feedback && <p className="text-[12px] text-danger flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> {feedback}</p>}
      <Button variant="primary" onClick={() => handlePack(count)} disabled={maxPossible < 1}>
        Pack Now
      </Button>
    </div>
  );
}