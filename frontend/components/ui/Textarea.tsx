import { forwardRef, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          "min-h-[80px] rounded-xl border border-border bg-surface-muted/50 px-3.5 py-2.5 text-sm text-foreground transition-all duration-150",
          "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 focus:bg-white",
          "hover:border-border-strong placeholder:text-text-tertiary",
          error && "border-danger focus:ring-danger/20 focus:border-danger",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
});
