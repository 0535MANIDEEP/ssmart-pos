import { clsx } from "clsx";

interface SeparatorProps {
  className?: string;
  vertical?: boolean;
}

export function Separator({ className, vertical }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={clsx(
        vertical
          ? "mx-2 h-6 w-px bg-border"
          : "my-2 h-px w-full bg-border",
        className
      )}
    />
  );
}
