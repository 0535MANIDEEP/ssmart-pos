import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  description?: string;
  onChange?: (checked: boolean) => void;
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle(
  { label, description, checked, className, onChange, ...props },
  ref
) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-start gap-2", className)}>
      <div className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          {...props}
        />
        <div className="h-5 w-9 rounded-full bg-border-strong transition-colors peer-checked:bg-brand" />
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </div>
      {(label || description) && (
        <div>
          {label && <span className="text-[13px] font-medium text-foreground">{label}</span>}
          {description && <p className="text-[12px] text-text-tertiary">{description}</p>}
        </div>
      )}
    </label>
  );
});
