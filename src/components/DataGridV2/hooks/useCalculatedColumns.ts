import { useMemo } from "react";

import { COL_OVERSCAN, DEFAULT_MIN_WIDTH } from "../constants";
import type {
  CalculatedColumn,
  Column,
  ColumnFrozen,
  RenderCellProps,
  RenderHeaderCellProps,
} from "../types";
import { clampColumnWidth } from "../utils";

const { max, min } = Math;

interface ColumnMetric {
  readonly width: number;
  readonly left: number;
}

interface UseCalculatedColumnsArgs<R> {
  readonly rawColumns: readonly Column<R>[];
  readonly scrollLeft: number;
  readonly viewportWidth: number;
  /**
   * Layer 6 resize overrides. Keyed by `column.key`; when present, replaces
   * `column.width` for the metrics/template pass. Constructing `columns`
   * itself stays independent of this map — so a resize tick produces new
   * `templateColumns` / `columnMetrics` / `layoutCssVars` without rebuilding
   * the `CalculatedColumn` array, keeping per-cell memo identities stable.
   */
  readonly resizedWidths: ReadonlyMap<string, number>;
}

export interface CalculatedColumnsResult<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  /** Index of the rightmost left-pinned column in `columns`, or -1 if none. */
  readonly lastFrozenLeftColumnIndex: number;
  /**
   * Index of the leftmost right-pinned column in `columns`, or `columns.length`
   * if none. Picking `columns.length` (rather than -1) lets the unfrozen-band
   * search use `<` without a special-case.
   */
  readonly firstFrozenRightColumnIndex: number;
  /** `grid-template-columns` value for the grid root. */
  readonly templateColumns: string;
  readonly columnMetrics: ReadonlyMap<CalculatedColumn<R>, ColumnMetric>;
  readonly totalFrozenLeftColumnWidth: number;
  readonly totalFrozenRightColumnWidth: number;
  /**
   * `--rdg-frozen-left-N` and `--rdg-frozen-right-N` vars, one per pinned
   * column. Spread onto the root grid element; consumed by pinned cells via
   * `inset-inline-start: var(--rdg-frozen-left-N)` (left) or
   * `inset-inline-end:   var(--rdg-frozen-right-N)` (right).
   */
  readonly layoutCssVars: Readonly<Record<string, string>>;
  readonly colOverscanStartIdx: number;
  readonly colOverscanEndIdx: number;
}

export function useCalculatedColumns<R>({
  rawColumns,
  scrollLeft,
  viewportWidth,
  resizedWidths,
}: UseCalculatedColumnsArgs<R>): CalculatedColumnsResult<R> {
  const { columns, lastFrozenLeftColumnIndex, firstFrozenRightColumnIndex } =
    useMemo(() => {
      // Stable sort into three bands: left-pinned → unpinned → right-pinned,
      // preserving caller order within each band. (Internal SELECT/EXPAND
      // injection sites in later layers prepend ahead of integrator left-pinned
      // columns; this hook only sees user columns.)
      const ordered = rawColumns
        .map((col, originalIdx) => ({ col, originalIdx }))
        .sort((a, b) => {
          const ba = bandOf(a.col.frozen);
          const bb = bandOf(b.col.frozen);
          if (ba !== bb) return ba - bb;
          return a.originalIdx - b.originalIdx;
        });

      const columns: CalculatedColumn<R>[] = ordered.map(({ col }, idx) => {
        const frozen = normalizeFrozen(col.frozen);
        return {
          ...col,
          idx,
          width: col.width ?? "auto",
          minWidth: col.minWidth ?? DEFAULT_MIN_WIDTH,
          maxWidth: col.maxWidth,
          frozen,
          resizable: col.resizable ?? false,
          // Pinned columns are never drag sources — the dnd-kit reorder zone
          // is the unpinned band only. Forced false here so consumers don't
          // need to re-check `frozen` everywhere.
          draggable: frozen ? false : (col.draggable ?? false),
          sortable: col.sortable ?? false,
          renderCell: col.renderCell ?? defaultRenderCell,
          renderHeaderCell: col.renderHeaderCell ?? defaultRenderHeaderCell,
        };
      });

      let lastFrozenLeftColumnIndex = -1;
      for (const column of columns) {
        if (column.frozen !== "left") break;
        lastFrozenLeftColumnIndex = column.idx;
      }
      let firstFrozenRightColumnIndex = columns.length;
      for (let i = columns.length - 1; i >= 0; i--) {
        if (columns[i].frozen !== "right") break;
        firstFrozenRightColumnIndex = i;
      }

      return {
        columns,
        lastFrozenLeftColumnIndex,
        firstFrozenRightColumnIndex,
      };
    }, [rawColumns]);

  const {
    templateColumns,
    columnMetrics,
    totalFrozenLeftColumnWidth,
    totalFrozenRightColumnWidth,
    layoutCssVars,
  } = useMemo(() => {
    const metrics = new Map<CalculatedColumn<R>, ColumnMetric>();
    const tracks: string[] = [];
    let left = 0;

    for (const column of columns) {
      // Resolution order: user-resized width (layer 6) → configured numeric
      // width → fallback to `minWidth` for non-numeric configs ("auto",
      // "1fr"). A measuring-cell pass for "auto" widths is intentionally not
      // implemented in v1 (plan §5.6 marks it skippable).
      const resized = resizedWidths.get(column.key);
      const width =
        resized !== undefined
          ? clampColumnWidth(resized, column)
          : typeof column.width === "number"
            ? clampColumnWidth(column.width, column)
            : column.minWidth;
      tracks.push(`${width}px`);
      metrics.set(column, { width, left });
      left += width;
    }

    let totalFrozenLeftColumnWidth = 0;
    if (lastFrozenLeftColumnIndex !== -1) {
      const m = metrics.get(columns[lastFrozenLeftColumnIndex])!;
      totalFrozenLeftColumnWidth = m.left + m.width;
    }
    let totalFrozenRightColumnWidth = 0;
    for (let i = firstFrozenRightColumnIndex; i < columns.length; i++) {
      totalFrozenRightColumnWidth += metrics.get(columns[i])!.width;
    }

    const layoutCssVars: Record<string, string> = {};
    // Left-pinned: cumulative width from the start (column N stops scrolling
    // at its natural left position).
    for (let i = 0; i <= lastFrozenLeftColumnIndex; i++) {
      const column = columns[i];
      layoutCssVars[`--rdg-frozen-left-${column.idx}`] =
        `${metrics.get(column)!.left}px`;
    }
    // Right-pinned: cumulative width *to its right* (rightmost column stops
    // at the right edge with offset 0; each preceding right-pinned column
    // adds the next column's width).
    let rightOffset = 0;
    for (let i = columns.length - 1; i >= firstFrozenRightColumnIndex; i--) {
      const column = columns[i];
      layoutCssVars[`--rdg-frozen-right-${column.idx}`] = `${rightOffset}px`;
      rightOffset += metrics.get(column)!.width;
    }

    return {
      templateColumns: tracks.join(" "),
      columnMetrics: metrics,
      totalFrozenLeftColumnWidth,
      totalFrozenRightColumnWidth,
      layoutCssVars,
    };
  }, [
    columns,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
    resizedWidths,
  ]);

  const [colOverscanStartIdx, colOverscanEndIdx] = useMemo<[number, number]>(
    () => {
      if (columns.length === 0) return [0, -1];

      // Bounds of the unpinned band. firstUnfrozenColumnIdx may exceed
      // lastUnfrozenColumnIdx when every column is pinned — handled below.
      const firstUnfrozenColumnIdx = lastFrozenLeftColumnIndex + 1;
      const lastUnfrozenColumnIdx = firstFrozenRightColumnIndex - 1;

      if (firstUnfrozenColumnIdx > lastUnfrozenColumnIdx) {
        // Every column is pinned; iterator only renders the pinned bands.
        return [firstUnfrozenColumnIdx, lastUnfrozenColumnIdx];
      }

      // Visible window for the unpinned band, in scroll-content coords.
      // Pinned bands cover both edges of the viewport, so the unpinned band's
      // visible width is `viewportWidth - leftPinned - rightPinned`.
      const viewportLeft = scrollLeft + totalFrozenLeftColumnWidth;
      const viewportRight =
        scrollLeft + viewportWidth - totalFrozenRightColumnWidth;

      // Pathological: pinned bands cover the entire viewport. Render only the
      // first unpinned column as a placeholder so the iterator has something
      // to work with; nothing visible to the user anyway.
      if (viewportLeft >= viewportRight) {
        return [firstUnfrozenColumnIdx, firstUnfrozenColumnIdx];
      }

      let visStart = firstUnfrozenColumnIdx;
      while (visStart < lastUnfrozenColumnIdx) {
        const { left, width } = columnMetrics.get(columns[visStart])!;
        if (left + width > viewportLeft) break;
        visStart++;
      }

      let visEnd = visStart;
      while (visEnd < lastUnfrozenColumnIdx) {
        const { left, width } = columnMetrics.get(columns[visEnd])!;
        if (left + width >= viewportRight) break;
        visEnd++;
      }

      return [
        max(firstUnfrozenColumnIdx, visStart - COL_OVERSCAN),
        min(lastUnfrozenColumnIdx, visEnd + COL_OVERSCAN),
      ];
    },
    [
      columnMetrics,
      columns,
      lastFrozenLeftColumnIndex,
      firstFrozenRightColumnIndex,
      scrollLeft,
      totalFrozenLeftColumnWidth,
      totalFrozenRightColumnWidth,
      viewportWidth,
    ],
  );

  return {
    columns,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
    templateColumns,
    columnMetrics,
    totalFrozenLeftColumnWidth,
    totalFrozenRightColumnWidth,
    layoutCssVars,
    colOverscanStartIdx,
    colOverscanEndIdx,
  };
}

function bandOf(frozen: ColumnFrozen | undefined): 0 | 1 | 2 {
  if (frozen === "right") return 2;
  if (frozen === "left" || frozen === true) return 0;
  return 1;
}

function normalizeFrozen(
  frozen: ColumnFrozen | undefined,
): "left" | "right" | false {
  if (frozen === "right") return "right";
  if (frozen === "left" || frozen === true) return "left";
  return false;
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
