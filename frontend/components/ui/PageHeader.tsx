import type { ReactNode } from "react";
import { clsx } from "clsx";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, action, className }: PageHeaderProps) {
  return (
    <div className={clsx("flex items-start justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
            <Icon className="h-4.5 w-4.5 text-brand" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
