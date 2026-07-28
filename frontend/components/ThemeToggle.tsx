"use client";

import { useState } from "react";
import { Sun, Moon, Monitor, Clock } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { clsx } from "clsx";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [autoTime, setAutoTime] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("ssmart-theme-auto") === "true"
  );

  function handleAutoTime() {
    const next = !autoTime;
    setAutoTime(next);
    if (next) {
      localStorage.setItem("ssmart-theme-auto", "true");
    } else {
      localStorage.removeItem("ssmart-theme-auto");
    }
  }

  const options: { value: typeof theme; icon: React.ElementType; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Theme</p>
      <div className="flex gap-1.5 rounded-lg border border-border bg-surface-muted p-1">
        {options.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
              theme === value
                ? "bg-surface shadow-sm text-foreground"
                : "text-text-secondary hover:text-foreground"
            )}
            title={`Switch to ${label} mode`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAutoTime}
        className={clsx(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all",
          autoTime
            ? "border-brand/30 bg-brand-light text-brand"
            : "border-border bg-surface text-text-secondary hover:border-brand/20 hover:text-foreground"
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        Auto-switch by time (Dark 7 PM – 6 AM)
        <span className={clsx(
          "ml-auto h-4 w-7 rounded-full p-0.5 transition-colors",
          autoTime ? "bg-brand" : "bg-border-strong"
        )}>
          <span className={clsx(
            "block h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
            autoTime ? "translate-x-3" : "translate-x-0"
          )} />
        </span>
      </button>
    </div>
  );
}

export function ThemeToggleCompact() {
  const { resolved, setTheme, theme } = useTheme();

  function cycle() {
    const order: typeof theme[] = ["light", "dark", "system"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  }

  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-muted transition-colors"
      title={`Theme: ${theme} (${resolved})`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
