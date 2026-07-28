import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { clsx } from "clsx";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-[13px] font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(
          "h-9 rounded-md border border-border bg-surface px-3 text-[13px] text-foreground placeholder:text-text-tertiary",
          "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20",
          error && "border-danger focus:ring-danger/20",
          className
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
