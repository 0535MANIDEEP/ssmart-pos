import type { ReactNode } from "react";
import { clsx } from "clsx";

interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  renderRow: (row: T, index: number) => ReactNode;
  renderFooter?: ReactNode | (() => ReactNode);
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  caption?: string;
  className?: string;
  compact?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  renderRow,
  renderFooter,
  emptyMessage = "No data found",
  emptyIcon: EmptyIcon,
  caption,
  className,
  compact,
}: DataTableProps<T>) {
  return (
    <div className={clsx("overflow-x-auto", className)}>
      <table className="data-table">
        {caption && <caption className="pb-2 text-left text-[13px] font-medium text-text-secondary">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={clsx(col.align === "right" && "text-right", col.align === "center" && "text-center")}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        {data.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns.length}>
                <div className="py-12 text-center">
                  {EmptyIcon && <EmptyIcon className="mx-auto mb-2 h-8 w-8 text-text-tertiary/40" />}
                  <p className="text-[13px] text-text-secondary">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {data.map((row, i) => renderRow(row, i))}
          </tbody>
        )}
        {renderFooter && <tfoot>{typeof renderFooter === "function" ? renderFooter() : renderFooter}</tfoot>}
      </table>
    </div>
  );
}
