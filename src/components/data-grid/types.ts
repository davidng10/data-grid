import type { ColumnDef, ColumnPinningState } from "@tanstack/react-table";
import type { CSSProperties } from "react";

export type { ColumnDef, ColumnPinningState };

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
  /**
   * Initial column pinning. Uncontrolled — TanStack Table owns the state
   * after mount. Use column ids (defaults to `accessorKey`).
   */
  defaultColumnPinning?: ColumnPinningState;
  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
};
