import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Check } from "lucide-react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
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
        <div className="h-5 w-5 rounded-lg border-2 border-border transition-all peer-checked:border-brand peer-checked:bg-brand" />
        {checked && (
          <Check className="absolute left-0.5 top-0.5 h-4 w-4 text-white" />
        )}
      </div>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
    </label>
  );
});
