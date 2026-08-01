"use client";

import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallBanner() {
  const { canInstall, promptInstall, dismiss, isDismissed } = useInstallPrompt();

  if (!canInstall || isDismissed()) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-brand px-4 py-2.5 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <Download className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          Install SS Mart for offline access — works without internet
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={promptInstall}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="rounded-lg p-1 hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
