"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, Pencil, Trash2, Search, Barcode as BarcodeIcon,
  Filter, ChevronDown, AlertTriangle, ScanBarcode,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProductModal } from "@/components/ProductModal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { effectivePrice } from "@/lib/quote";
import type { Product } from "@/lib/types";

type ModalState = { mode: "add"; initialBarcode?: string } | { mode: "edit"; product: Product } | null;

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showLowStock, setShowLowStock] = useState(false);
  const { data: shop } = useShopSettings();
  const { show } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", search],
    queryFn: () => api.get<Product[]>(`/products?q=${encodeURIComponent(search)}&bulk=true`),
    staleTime: 30_000,
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["product-categories"],
    queryFn: () => api.get<string[]>("/products/categories"),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      show("Product deleted", "success");
    },
    onError: (err: any) => show(describeApiError(err), "error"),
  });

  const sym = shop?.currencySymbol || "\u20B9";
  const money = (n: number) => formatMoney(n, sym);
  const lowStockThreshold = shop?.lowStockAlert ?? 5;

  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (showLowStock && p.stock > lowStockThreshold) return false;
    return true;
  });

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
        setModal({ mode: "edit", product });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) setModal({ mode: "add", initialBarcode: code });
        else show("Barcode lookup failed", "error");
      }
    },
    [show]
  );

  useBarcodeScanner({ onScan: handleScan, enabled: !modal });

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(product.id);
    } catch (err) {
      show(describeApiError(err), "error");
    }
  }

  const lowStockCount = products.filter((p) => p.stock <= lowStockThreshold).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-sm text-text-secondary">{products.length} products · {lowStockCount} low stock</p>
        </div>
        <Button onClick={() => setModal({ mode: "add" })} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, barcode, or HSN..."
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-text-tertiary focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
              showLowStock
                ? 'border-warning bg-warning/10 text-warning'
                : 'border-border text-text-secondary hover:bg-surface-muted'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Low Stock {lowStockCount > 0 && `(${lowStockCount})`}
          </button>
        </div>
      </Card>

      {/* Products Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-text-secondary">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-text-tertiary mb-3" />
            <p className="text-base font-medium text-foreground">No products found</p>
            <p className="text-sm text-text-secondary mt-1">
              {search ? "Try a different search term" : "Add your first product to get started"}
            </p>
            {!search && (
              <Button onClick={() => setModal({ mode: "add" })} className="mt-4">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-xs uppercase tracking-wider text-text-secondary">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Barcode</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">HSN</th>
                  <th className="px-4 py-3 text-right font-semibold">MRP</th>
                  <th className="px-4 py-3 text-right font-semibold">Selling</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredProducts.map((product) => {
                  const isLowStock = product.stock <= lowStockThreshold;
                  return (
                    <tr key={product.id} className={`hover:bg-surface-muted/30 transition-colors ${isLowStock ? 'bg-warning/5' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light text-brand">
                            <Package className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-text-secondary">{product.unit || "pc"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {product.barcode ? (
                          <span className="font-mono text-xs bg-surface-muted px-2 py-1 rounded">{product.barcode}</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.category ? (
                          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{product.category}</span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{product.hsn || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{money(product.mrp)}</td>
                      <td className="px-4 py-3 text-right font-medium text-brand">{money(product.sellingPrice)}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{money(product.purchasePrice)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isLowStock ? 'text-warning font-semibold' : 'text-foreground'}`}>
                          {product.stock}
                        </span>
                        {isLowStock && <span className="ml-1 text-warning text-xs">LOW</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setModal({ mode: "edit", product })}
                            className="rounded p-1.5 text-text-secondary hover:bg-brand/10 hover:text-brand transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="rounded p-1.5 text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <ProductModal
          mode={modal.mode}
          initialBarcode={modal.mode === "add" ? modal.initialBarcode : undefined}
          product={modal.mode === "edit" ? modal.product : undefined}
          onClose={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}
    </div>
  );
}
