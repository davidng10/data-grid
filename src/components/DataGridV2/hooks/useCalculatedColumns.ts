import { useMemo } from "react";

import { COL_OVERSCAN, DEFAULT_MIN_WIDTH } from "../constants";
import type {
  CalculatedColumn,
  Column,
  RenderCellProps,
  RenderHeaderCellProps,
} from "../types";

const { max, min } = Math;

interface ColumnMetric {
  readonly width: number;
  readonly left: number;
}

interface UseCalculatedColumnsArgs<R> {
  readonly rawColumns: readonly Column<R>[];
  readonly scrollLeft: number;
  readonly viewportWidth: number;
}

export interface CalculatedColumnsResult<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  /** Index of the rightmost frozen column in `columns`, or -1 if none. */
  readonly lastFrozenColumnIndex: number;
  /** `grid-template-columns` value for the grid root. */
  readonly templateColumns: string;
  readonly columnMetrics: ReadonlyMap<CalculatedColumn<R>, ColumnMetric>;
  /** Sum of all frozen column widths; layer 3 uses this for the shadow inset. */
  readonly totalFrozenColumnWidth: number;
  readonly colOverscanStartIdx: number;
  readonly colOverscanEndIdx: number;
}

export function useCalculatedColumns<R>({
  rawColumns,
  scrollLeft,
  viewportWidth,
}: UseCalculatedColumnsArgs<R>): CalculatedColumnsResult<R> {
  const { columns, lastFrozenColumnIndex } = useMemo(() => {
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

    return { columns, lastFrozenColumnIndex };
  }, [rawColumns]);

  const { templateColumns, columnMetrics, totalFrozenColumnWidth } =
    useMemo(() => {
      const metrics = new Map<CalculatedColumn<R>, ColumnMetric>();
      const tracks: string[] = [];
      let left = 0;

      for (const column of columns) {
        // Non-numeric widths ("auto", "1fr") fall back to `minWidth` for both
        // the metric *and* the template track. Layer 6 will replace this with
        // a measuring-cell pass that resolves the natural width on commit.
        const width =
          typeof column.width === "number"
            ? clampColumnWidth(column.width, column)
            : column.minWidth;
        tracks.push(`${width}px`);
        metrics.set(column, { width, left });
        left += width;
      }

      let totalFrozenColumnWidth = 0;
      if (lastFrozenColumnIndex !== -1) {
        const m = metrics.get(columns[lastFrozenColumnIndex])!;
        totalFrozenColumnWidth = m.left + m.width;
      }

      return {
        templateColumns: tracks.join(" "),
        columnMetrics: metrics,
        totalFrozenColumnWidth,
      };
    }, [columns, lastFrozenColumnIndex]);

  const [colOverscanStartIdx, colOverscanEndIdx] = useMemo<[number, number]>(
    () => {
      if (columns.length === 0) return [0, -1];

      const lastColIdx = columns.length - 1;
      const firstUnfrozenColumnIdx = min(lastFrozenColumnIndex + 1, lastColIdx);

      // Viewport bounds for the *unfrozen* track strip. Frozen columns sit
      // outside the scrolling region (they're always rendered), so we only
      // search the non-frozen range here.
      const viewportLeft = scrollLeft + totalFrozenColumnWidth;
      const viewportRight = scrollLeft + viewportWidth;

      // Pathological: frozen columns cover the entire viewport. Render only
      // the first unfrozen column as the placeholder so the iterator has
      // something to work with; nothing visible to the user anyway.
      if (viewportLeft >= viewportRight) {
        return [firstUnfrozenColumnIdx, firstUnfrozenColumnIdx];
      }

      let visStart = firstUnfrozenColumnIdx;
      while (visStart < lastColIdx) {
        const { left, width } = columnMetrics.get(columns[visStart])!;
        if (left + width > viewportLeft) break;
        visStart++;
      }

      let visEnd = visStart;
      while (visEnd < lastColIdx) {
        const { left, width } = columnMetrics.get(columns[visEnd])!;
        if (left + width >= viewportRight) break;
        visEnd++;
      }

      return [
        max(firstUnfrozenColumnIdx, visStart - COL_OVERSCAN),
        min(lastColIdx, visEnd + COL_OVERSCAN),
      ];
    },
    [
      columnMetrics,
      columns,
      lastFrozenColumnIndex,
      scrollLeft,
      totalFrozenColumnWidth,
      viewportWidth,
    ],
  );

  return {
    columns,
    lastFrozenColumnIndex,
    templateColumns,
    columnMetrics,
    totalFrozenColumnWidth,
    colOverscanStartIdx,
    colOverscanEndIdx,
  };
}

function clampColumnWidth<R>(
  width: number,
  { minWidth, maxWidth }: CalculatedColumn<R>,
): number {
  const clamped = max(width, minWidth);
  if (typeof maxWidth === "number" && maxWidth >= minWidth) {
    return min(clamped, maxWidth);
  }
  return clamped;
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
