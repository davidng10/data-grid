import type {
  ColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
  RowData,
} from "@tanstack/react-table";
import type { CSSProperties } from "react";

declare module "@tanstack/react-table" {
  // TanStack treats TableMeta as a user-augmented bag; declaring updateData
  // here lets cells reach `table.options.meta.updateData` with full types.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData?: (
      rowIndex: number,
      columnId: string,
      value: unknown,
    ) => void | Promise<void>;
  }
}

export type {
  ColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  OnChangeFn,
};

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
  /**
   * Controlled column order. The caller owns the array and must update it
   * from `onColumnOrderChange` for reorder to take effect. Reorder is enabled
   * only when `onColumnOrderChange` is provided. The array must contain the
   * id of every column in `columns`; passing a partial list will lead to
   * undefined ordering for the missing ones. Pinned columns may appear
   * anywhere in the array — their pinned position is determined by
   * `columnPinning`, not their index here.
   */
  columnOrder?: ColumnOrderState;
  /**
   * Called during drag (live commit, on every cross-over) with an updater
   * (value or `(prev) => next`) — compatible with `useState`'s setter. Only
   * non-pinned (center) columns are reorderable, and only within the center
   * zone; pinned columns are not draggable and not valid drop targets.
   */
  onColumnOrderChange?: OnChangeFn<ColumnOrderState>;
  /**
   * Called when a cell commits an edit. Return a Promise to lock the cell
   * (input stays mounted, disabled) until it resolves; rejection is treated
   * as failure and the parent is expected to have reverted its data state.
   * Reaches cells through `table.options.meta.updateData`.
   */
  onCellChange?: (
    rowIndex: number,
    columnId: string,
    value: unknown,
  ) => void | Promise<void>;
  rowHeight?: number;
  overscan?: number;
  className?: string;
  style?: CSSProperties;
};
