import { useMemo } from "react";

import { DEFAULT_MIN_WIDTH } from "../constants";
import type {
  CalculatedColumn,
  Column,
  RenderCellProps,
  RenderHeaderCellProps,
} from "../types";

export interface CalculatedColumnsResult<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  /** Index of the rightmost frozen column in `columns`, or -1 if none. */
  readonly lastFrozenColumnIndex: number;
  /** `grid-template-columns` value for the grid root. */
  readonly templateColumns: string;
}

export function useCalculatedColumns<R>(
  rawColumns: readonly Column<R>[],
): CalculatedColumnsResult<R> {
  return useMemo(() => {
    // Stable sort: frozen before unfrozen, preserving the caller's order
    // within each group. (Internal SELECT/EXPAND columns prepend at their
    // own injection sites in later layers — this hook only sees user columns.)
    const ordered = rawColumns
      .map((col, originalIdx) => ({ col, originalIdx }))
      .sort((a, b) => {
        const af = a.col.frozen ? 1 : 0;
        const bf = b.col.frozen ? 1 : 0;
        if (af !== bf) return bf - af;
        return a.originalIdx - b.originalIdx;
      });

    const columns: CalculatedColumn<R>[] = ordered.map(({ col }, idx) => ({
      ...col,
      idx,
      width: col.width ?? "auto",
      minWidth: col.minWidth ?? DEFAULT_MIN_WIDTH,
      maxWidth: col.maxWidth,
      frozen: col.frozen ?? false,
      resizable: col.resizable ?? false,
      draggable: col.draggable ?? false,
      sortable: col.sortable ?? false,
      renderCell: col.renderCell ?? defaultRenderCell,
      renderHeaderCell: col.renderHeaderCell ?? defaultRenderHeaderCell,
    }));

    let lastFrozenColumnIndex = -1;
    for (const column of columns) {
      if (!column.frozen) break;
      lastFrozenColumnIndex = column.idx;
    }

    const templateColumns = columns
      .map((c) => (typeof c.width === "number" ? `${c.width}px` : c.width))
      .join(" ");

    return { columns, lastFrozenColumnIndex, templateColumns };
  }, [rawColumns]);
}

function defaultRenderCell<R>({ column, row }: RenderCellProps<R>) {
  // If the row is a plain record with a field matching the column key, render
  // it. Consumers override via `column.renderCell` when they want anything else.
  const value = (row as Record<string, unknown>)[column.key];
  return value == null ? null : String(value);
}

function defaultRenderHeaderCell<R>({ column }: RenderHeaderCellProps<R>) {
  return column.name;
}
