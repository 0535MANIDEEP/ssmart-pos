import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { clsx } from "clsx";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, helperText, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          "h-10 rounded-lg border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-text-tertiary",
          "transition-all duration-150",
          "hover:border-border-strong",
          "focus:border-brand focus:ring-2 focus:ring-brand/10 focus:outline-none",
          error && "border-danger focus:border-danger focus:ring-danger/10",
          className
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      )}
      {!error && helperText && <p className="text-[11px] text-foreground/50">{helperText}</p>}
    </div>
  );
});
