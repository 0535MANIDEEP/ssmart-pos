"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { clsx } from "clsx";

interface QuantityPopoverProps {
  product: { id: number; stock: number; name: string };
  quantity: number;
  onSetQuantity: (qty: number) => void;
}

const PRESETS = [1, 2, 3, 5, 10, 20, 50];

export function QuantityPopover({ product, quantity, onSetQuantity }: QuantityPopoverProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(String(quantity));
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter") {
        const val = parseInt(inputValue, 10);
        if (!isNaN(val) && val > 0) {
          onSetQuantity(Math.min(val, product.stock));
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, inputValue, onSetQuantity, product.stock]);

  const handlePreset = useCallback(
    (preset: number) => {
      if (preset > product.stock) return;
      onSetQuantity(preset);
      setInputValue(String(preset));
      setOpen(false);
    },
    [onSetQuantity, product.stock]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val > 0) {
      onSetQuantity(Math.min(val, product.stock));
    } else {
      setInputValue(String(quantity));
    }
    setOpen(false);
  }, [inputValue, onSetQuantity, quantity, product.stock]);

  const isOverStock = parseInt(inputValue, 10) > product.stock;

  return (
    <div ref={popoverRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setInputValue(String(quantity)); setOpen(!open); }}
        className={clsx(
          "flex h-8 w-12 items-center justify-center rounded-md border text-sm font-medium transition-colors",
          open
            ? "border-brand bg-brand/10 text-brand"
            : "border-border bg-surface hover:bg-surface-muted text-foreground"
        )}
        aria-label={`Quantity: ${quantity}. Click to edit.`}
      >
        {quantity}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-48 rounded-lg border border-border bg-surface shadow-xl p-3">
          <p className="mb-2 text-xs font-medium text-foreground/60">Quick quantity</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.filter((p) => p <= product.stock).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  quantity === preset
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-surface hover:bg-surface-muted text-foreground"
                )}
              >
                {preset}
                {quantity === preset && <Check className="ml-0.5 h-3 w-3" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={product.stock}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              className={clsx(
                "w-full rounded-md border px-2 py-1.5 text-sm text-center outline-none transition-colors",
                isOverStock
                  ? "border-danger focus:ring-danger"
                  : "border-border focus:ring-brand"
              )}
              aria-label={`Custom quantity for ${product.name}`}
              autoFocus
            />
            {isOverStock && (
              <span className="shrink-0 text-xs text-danger" title={`Only ${product.stock} in stock`}>Max {product.stock}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}