"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "info" | "error" | "success";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantConfig = {
  success: { icon: CheckCircle2, border: "border-success/30", bg: "bg-success-light", text: "text-success", gradient: "from-success/10 to-success-light" },
  error: { icon: AlertCircle, border: "border-danger/30", bg: "bg-danger-light", text: "text-danger", gradient: "from-danger/10 to-danger-light" },
  info: { icon: Info, border: "border-brand/20", bg: "bg-brand-light", text: "text-brand", gradient: "from-brand/10 to-brand-light" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="region" aria-live="polite">
        {toasts.map((toast) => {
          const config = variantConfig[toast.variant];
          const Icon = config.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-3 rounded-xl border ${config.border} bg-gradient-to-r ${config.gradient} px-4 py-3 shadow-lg animate-slide-in-right backdrop-blur-sm`}
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${config.text}`} />
              </div>
              <p className="flex-1 pt-0.5 text-[13px] leading-snug text-foreground">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface/50 hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
