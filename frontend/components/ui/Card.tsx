import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

type CardVariant = "default" | "elevated" | "bordered" | "success" | "warning" | "danger" | "brand" | "glass";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
}

const variants: Record<string, string> = {
  default: "bg-surface border border-border shadow-sm",
  elevated: "bg-surface border border-border shadow-md",
  bordered: "bg-surface border-2 border-border",
  success: "bg-surface border border-success/20 shadow-sm",
  warning: "bg-surface border border-warning/20 shadow-sm",
  danger: "bg-surface border border-danger/20 shadow-sm",
  brand: "bg-surface border border-brand/20 shadow-sm",
  glass: "bg-surface/80 backdrop-blur-sm border border-border shadow-sm",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", hoverable, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-xl",
        variants[variant] || variants.default,
        hoverable && "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
