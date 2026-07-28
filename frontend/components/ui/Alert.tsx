import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: ReactNode;
  title?: string;
}

const config: Record<AlertVariant, { icon: React.ElementType; border: string; bg: string; text: string }> = {
  info: { icon: Info, border: "border-brand/20", bg: "bg-brand-light", text: "text-brand" },
  success: { icon: CheckCircle2, border: "border-success/20", bg: "bg-success-light", text: "text-success" },
  warning: { icon: AlertTriangle, border: "border-warning/20", bg: "bg-warning-light", text: "text-warning" },
  danger: { icon: AlertCircle, border: "border-danger/20", bg: "bg-danger-light", text: "text-danger" },
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant = "info", icon, title, className, children, ...props },
  ref
) {
  const c = config[variant];
  const Icon = icon === undefined ? c.icon : null;

  return (
    <div
      ref={ref}
      role="alert"
      className={clsx(
        "flex items-start gap-3 rounded-lg border p-3 text-[13px]",
        c.border, c.bg, className
      )}
      {...props}
    >
      {Icon && <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", c.text)} />}
      <div className="flex-1">
        {title && <p className={clsx("mb-0.5 font-medium", c.text)}>{title}</p>}
        <div className="text-text-secondary">{children}</div>
      </div>
    </div>
  );
});
