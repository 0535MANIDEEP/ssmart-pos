import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

type CardVariant = "default" | "elevated" | "bordered" | "success" | "warning" | "danger" | "brand" | "glass";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
}

const variants: Record<string, string> = {
  default: "bg-surface border border-border",
  elevated: "bg-surface border border-border shadow-sm",
  bordered: "bg-surface border-2 border-border",
  success: "bg-surface border border-success/20",
  warning: "bg-surface border border-warning/20",
  danger: "bg-surface border border-danger/20",
  brand: "bg-surface border border-brand/20",
  glass: "bg-surface/80 backdrop-blur-sm border border-border",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", hoverable, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-lg",
        variants[variant] || variants.default,
        hoverable && "transition-shadow hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
