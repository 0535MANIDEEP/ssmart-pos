import { forwardRef, type SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, options, className, children, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-foreground">{label}</label>
      )}
      <select
        ref={ref}
        className={clsx(
          "h-10 rounded-lg border border-border bg-surface px-3 text-[13px] text-foreground",
          "transition-all duration-150",
          "hover:border-border-strong",
          "focus:border-brand focus:ring-2 focus:ring-brand/10 focus:outline-none",
          error && "border-danger focus:border-danger focus:ring-danger/10",
          className
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-foreground/50">{helperText}</p>}
    </div>
  );
});
