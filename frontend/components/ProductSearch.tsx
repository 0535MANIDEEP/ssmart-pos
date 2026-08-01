"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Clock, Tag, Grid3X3, Hash, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { useProducts } from "@/hooks/useProducts";
import { searchProductsLocal } from "@/lib/offline-store";
import { SkeletonTableRows } from "./ui/Skeleton";
import type { Product } from "@/lib/types";

interface ProductSearchProps {
  onAddToCart: (product: Product) => void;
  disabled?: boolean;
}

function useCategories() {
  const query = useQuery<string[]>({
    queryKey: ["product-categories"],
    queryFn: () => api.get<string[]>("/products/categories"),
    staleTime: 60_000,
  });

  // Offline fallback: derive categories from local IndexedDB
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  useEffect(() => {
    if (!navigator.onLine && query.data === undefined) {
      import("@/lib/offline-store").then(({ getAllProducts }) =>
        getAllProducts().then((products) => {
          const cats = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
          setLocalCategories(cats.sort());
        })
      );
    }
  }, [query.data]);

  return {
    ...query,
    data: query.data ?? (navigator.onLine ? undefined : localCategories),
  };
}

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem("ssmart-recent-searches") || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((s) => s !== query);
    localStorage.setItem("ssmart-recent-searches", JSON.stringify([query, ...filtered].slice(0, 8)));
  } catch {}
}

function getRecentProducts(): number[] {
  try {
    return JSON.parse(localStorage.getItem("ssmart-recent-products") || "[]");
  } catch {
    return [];
  }
}

function saveRecentProduct(id: number) {
  try {
    const existing = getRecentProducts();
    const filtered = existing.filter((i) => i !== id);
    localStorage.setItem("ssmart-recent-products", JSON.stringify([id, ...filtered].slice(0, 6)));
  } catch {}
}

export function ProductSearch({ onAddToCart, disabled }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [], isLoading: catLoading } = useCategories();

  useEffect(() => {
    const t = setTimeout(() => setCommittedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data: serverResults, isFetching } = useProducts(committedQuery, activeCategory);

  // Offline fallback: search local IndexedDB when server is unavailable
  const [localResults, setLocalResults] = useState<Product[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!navigator.onLine || (serverResults === undefined && !isFetching)) {
      setIsOffline(!navigator.onLine);
      if (committedQuery || activeCategory) {
        searchProductsLocal(committedQuery, activeCategory || undefined)
          .then((r) => setLocalResults(r as unknown as Product[]))
          .catch(() => setLocalResults([]));
      }
    } else {
      setIsOffline(false);
    }
  }, [serverResults, isFetching, committedQuery, activeCategory]);

  const results = isOffline ? localResults : serverResults;
  const recentIds = useMemo(() => getRecentProducts(), []);

  const recentProducts = useMemo(() => {
    if (!results || recentIds.length === 0) return [];
    const map = new Map(results.map((p) => [p.id, p]));
    return recentIds.map((id) => map.get(id)).filter(Boolean) as Product[];
  }, [results, recentIds]);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return activeCategory
      ? results.filter((p) => p.category === activeCategory)
      : results;
  }, [results, activeCategory]);

  const recentSearches = useMemo(() => getRecentSearches(), []);

  const showDropdown = isOpen && (committedQuery.length > 0 || activeCategory.length > 0 || recentSearches.length > 0 || recentProducts.length > 0);

  const resetFocus = useCallback(() => setFocusIndex(0), []);

  useEffect(() => {
    if (committedQuery !== "") resetFocus();
  }, [committedQuery, activeCategory, resetFocus]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        setCommittedQuery("");
        setActiveCategory("");
        return;
      }
      if (!showDropdown) return;
      const total = Math.max(1, filteredResults.length);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % total);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === "Enter" && focusIndex >= 0 && focusIndex < filteredResults.length) {
        e.preventDefault();
        onAddToCart(filteredResults[focusIndex]);
        saveRecentSearch(filteredResults[focusIndex].name);
        saveRecentProduct(filteredResults[focusIndex].id);
        setQuery("");
        setCommittedQuery("");
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showDropdown, filteredResults, focusIndex, onAddToCart]);

  const handleSelect = useCallback(
    (product: Product) => {
      onAddToCart(product);
      saveRecentSearch(product.name);
      saveRecentProduct(product.id);
      setQuery("");
      setCommittedQuery("");
      setIsOpen(false);
    },
    [onAddToCart]
  );

  const handleClearCategory = useCallback(() => {
    setActiveCategory("");
    setQuery("");
    setCommittedQuery("");
    inputRef.current?.focus();
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/50 px-4 py-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-sm">
          <Search className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search by name, barcode, or SKU..."
            aria-label="Search products"
            aria-autocomplete="list"
            aria-controls="product-search-listbox"
            aria-expanded={showDropdown}
            disabled={disabled}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setCommittedQuery(""); setActiveCategory(""); }} className="text-foreground/40 hover:text-foreground transition">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </div>
        </div>

        {showDropdown && (
          <div id="product-search-listbox" role="listbox" className="absolute z-30 mt-2 w-full max-h-80 overflow-auto rounded-xl border border-border bg-surface/95 backdrop-blur-md shadow-2xl animate-scale-in">
            {isFetching && committedQuery && (
              <div className="px-4 py-3"><SkeletonTableRows rows={4} /></div>
            )}

            {!isFetching && committedQuery && (!results || results.length === 0) && (
              <div className="px-4 py-6 text-center">
                <Hash className="h-8 w-8 text-text-tertiary mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No products found</p>
                <p className="text-xs text-text-tertiary mt-1">Try a different search term or category</p>
              </div>
            )}

            {recentProducts.length > 0 && committedQuery === "" && !activeCategory && (
              <div className="border-b border-border">
                <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Recently viewed
                </div>
                {recentProducts.map((p) => (
                  <button key={p.id} type="button" role="option" onClick={() => handleSelect(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted transition">
                    <span className="flex-1 min-w-0 truncate font-medium text-foreground">{p.name}</span>
                    <StockBadge stock={p.stock} />
                    <span className="shrink-0 text-sm font-semibold text-foreground">{p.sellingPrice.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}

            {recentSearches.length > 0 && committedQuery === "" && !activeCategory && (
              <div className="border-b border-border">
                <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Recent searches
                </div>
                {recentSearches.slice(0, 5).map((s) => (
                  <button key={s} type="button" role="option" onClick={() => { setQuery(s); setCommittedQuery(s); setIsOpen(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted transition">
                    <Search className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="truncate text-foreground/80">{s}</span>
                  </button>
                ))}
              </div>
            )}

            {categories.length > 0 && committedQuery === "" && (
              <div className="border-b border-border px-3 py-2 flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button key={cat} type="button" onClick={() => { setActiveCategory(cat); setQuery(""); setCommittedQuery(""); setIsOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border border-border bg-surface-muted/50 text-foreground/70 hover:bg-brand-light hover:text-brand hover:border-brand/30 transition">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {activeCategory && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <span className="text-xs font-semibold text-brand bg-brand-light px-2 py-0.5 rounded-full">{activeCategory}</span>
                <button type="button" onClick={handleClearCategory} className="text-xs text-text-tertiary hover:text-foreground transition">Clear filter</button>
              </div>
            )}

            {filteredResults.length > 0 && (
              <div>
                {filteredResults.map((p, i) => {
                  const outOfStock = p.stock <= 0;
                  return (
                    <button key={p.id} type="button" role="option" aria-selected={focusIndex === i} onClick={() => handleSelect(p)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${focusIndex === i ? "bg-brand-light/50" : "hover:bg-surface-muted"} ${outOfStock ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} border-b border-border/50 last:border-b-0`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{p.name}</span>
                          {outOfStock && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-danger bg-danger/10 px-1.5 py-0.5 rounded-full">Out</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {p.barcode && <span className="text-[11px] text-foreground/40 flex items-center gap-1"><Hash className="h-2.5 w-2.5" aria-hidden="true" />{p.barcode}</span>}
                          {p.category && <span className="text-[11px] text-foreground/40 flex items-center gap-1"><Tag className="h-2.5 w-2.5" aria-hidden="true" />{p.category}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="font-semibold text-foreground">{p.sellingPrice.toFixed(2)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {committedQuery.length > 0 && !isFetching && results && results.length === 0 && (
              <div className="px-4 py-6 text-center">
                <Grid3X3 className="h-8 w-8 text-text-tertiary mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No matches for &ldquo;{committedQuery}&rdquo;</p>
                <p className="text-xs text-text-tertiary mt-1">Check spelling or try a different term</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-danger bg-danger/10 px-1.5 py-0.5 rounded-full">Out</span>;
  if (stock <= 5) return <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Low</span>;
  return null;
}