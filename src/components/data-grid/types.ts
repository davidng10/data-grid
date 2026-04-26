import type { ColumnDef } from "@tanstack/react-table";
import type { CSSProperties } from "react";

export type { ColumnDef };

/**
 * Props for the DataGrid component.
 *
 * NOTE: `data` and `columns` MUST be referentially stable across renders
 * (memoize them at the call site). Passing fresh arrays each render forces
 * TanStack Table to rebuild its internal model on every render and will tank
 * performance at scale.
 */
export type DataGridProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
};
