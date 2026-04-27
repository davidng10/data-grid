import type {
  ColumnDef,
  ColumnPinningState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { CSSProperties } from "react";

export type { ColumnDef, ColumnPinningState, OnChangeFn };

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
   * Controlled column pinning. The caller owns the state and must update it
   * from `onColumnPinningChange` for pinning to change. Use column ids
   * (defaults to `accessorKey`).
   */
  columnPinning?: ColumnPinningState;
  /**
   * Called when pinning changes. Receives an updater (value or
   * `(prev) => next`) — compatible with `useState`'s setter, so
   * `onColumnPinningChange={setPinning}` works.
   */
  onColumnPinningChange?: OnChangeFn<ColumnPinningState>;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
};
