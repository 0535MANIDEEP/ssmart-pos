import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-brand text-white",
    "bg-emerald-500 text-white",
    "bg-amber-500 text-white",
    "bg-rose-500 text-white",
    "bg-violet-500 text-white",
    "bg-cyan-500 text-white",
    "bg-indigo-500 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { name, size = "md", className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        sizeClasses[size],
        getColorFromName(name),
        className
      )}
      title={name}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
});
