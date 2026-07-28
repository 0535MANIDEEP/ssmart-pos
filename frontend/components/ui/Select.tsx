import { forwardRef, type SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, className, children, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[13px] font-medium text-foreground">{label}</label>
      )}
      <select
        ref={ref}
        className={clsx(
          "h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-foreground",
          "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20",
          error && "border-danger",
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
    </div>
  );
});
