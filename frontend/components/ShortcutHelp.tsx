"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["F1"], label: "Show keyboard shortcuts" },
  { keys: ["F2"], label: "Focus search / barcode input" },
  { keys: ["F4"], label: "Hold current bill" },
  { keys: ["F9"], label: "Settle / checkout" },
  { keys: ["F11"], label: "New bill (clear cart)" },
  { keys: ["Esc"], label: "Close panel / dialog" },
  { keys: ["Enter"], label: "Add scanned item" },
  { keys: ["Ctrl", "P"], label: "Print last receipt" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground/60 shadow-md transition-colors hover:bg-surface-muted hover:text-foreground"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="relative z-10 w-full max-w-md animate-scale-in rounded-xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-foreground/50 hover:bg-surface-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-muted"
                >
                  <span className="text-sm text-foreground/80">
                    {s.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground/70"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
