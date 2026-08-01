"use client";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { clsx } from "clsx";

interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
}

export function LoadingOverlay({ loading, message = "Loading…" }: LoadingOverlayProps) {
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-surface border border-border p-6 shadow-2xl">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-foreground/70">{message}</p>
      </div>
    </div>
  );
}