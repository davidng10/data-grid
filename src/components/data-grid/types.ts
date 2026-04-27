import type {
  ColumnDef,
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { CSSProperties } from "react";

export type { ColumnDef, ColumnPinningState, ColumnSizingState, OnChangeFn };

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
  /**
   * Controlled column sizing. The caller owns the state; resize is a no-op
   * unless `onColumnSizingChange` is also provided. Keys are column ids,
   * values are pixel widths. Per-column `minSize`/`maxSize` on the column def
   * are respected during drag; the global floor is `DEFAULT_MIN_COLUMN_WIDTH`.
   */
  columnSizing?: ColumnSizingState;
  /**
   * Called once at mouseup with an updater (value or `(prev) => next`) —
   * compatible with `useState`'s setter. Drag itself does not produce React
   * state updates; only the final committed width does.
   */
  onColumnSizingChange?: OnChangeFn<ColumnSizingState>;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
};
