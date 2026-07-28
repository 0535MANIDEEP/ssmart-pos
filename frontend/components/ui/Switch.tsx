import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, checked, className, ...props },
  ref
) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-center gap-2.5", className)}>
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          {...props}
        />
        <div className="h-6 w-11 rounded-full bg-surface-muted transition-colors peer-checked:bg-brand" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </div>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
    </label>
  );
});
