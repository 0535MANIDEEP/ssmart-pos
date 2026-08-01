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
    <label className={clsx("inline-flex cursor-pointer items-start gap-3", className)}>
      <div className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          {...props}
        />
        <div className="h-6 w-11 rounded-full bg-border-strong transition-colors duration-200 peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 peer-focus-visible:ring-offset-2" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 peer-checked:translate-x-5" />
      </div>
      {(label || description) && (
        <div className="min-w-0">
          {label && <span className="text-[13px] font-medium text-foreground">{label}</span>}
          {description && <p className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{description}</p>}
        </div>
      )}
    </label>
  );
});
