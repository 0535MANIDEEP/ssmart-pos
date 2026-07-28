import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "brand";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-text-secondary border border-border",
  success: "bg-success-light text-success border border-success/20",
  warning: "bg-warning-light text-warning border border-warning/20",
  danger: "bg-danger-light text-danger border border-danger/20",
  brand: "bg-brand-light text-brand border border-brand/20",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "default", className, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium leading-5",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});
