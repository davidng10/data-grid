import { useCallback, useMemo } from "react";

import type { CalculatedColumn } from "../types";

const { max, min } = Math;

interface UseViewportColumnsArgs<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  readonly colOverscanStartIdx: number;
  readonly colOverscanEndIdx: number;
  readonly lastFrozenLeftColumnIndex: number;
  readonly firstFrozenRightColumnIndex: number;
}

/**
 * Tuple yielded by the per-row column iterator.
 * `[column, isCellActive]`. `isCellActive` is the cheap shallow-equal flag
 * each `Cell` reads to decide whether to switch into the active rendering
 * (roving tab-index, focus ring, etc.).
 */
export type ViewportColumnEntry<R> = readonly [
  column: CalculatedColumn<R>,
  isCellActive: boolean,
];

export type IterateOverViewportColumnsForRow<R> = (
  activeColumnIdx: number,
  /**
   * When `true` and `activeColumnIdx` is in bounds, yields *only* the active
   * column. Used by the row iterator in `DataGrid.tsx` when rendering the
   * active row outside the overscan window — there is no point materialising
   * the rest of the viewport slice for a row the user can't see.
   */
  isRowOutsideViewport?: boolean,
) => Iterable<ViewportColumnEntry<R>>;

export interface UseViewportColumnsResult<R> {
  /**
   * `[...left-pinned, ...overscan, ...right-pinned]`. Stable across renders
   * unless the slice itself changes — header rows and non-active data rows
   * use this directly. The iterator below additionally yields the active
   * column when it sits outside the overscan window.
   */
  readonly viewportColumns: readonly CalculatedColumn<R>[];
  readonly iterateOverViewportColumnsForRow: IterateOverViewportColumnsForRow<R>;
}

/**
 * Returns the column slice currently inside the viewport plus a per-row
 * iterator. Rows pass their own `activeColumnIdx` (or `-1` for non-active
 * rows): the iterator yields the standard slice and additionally injects the
 * active unpinned column when it has been scrolled outside the overscan
 * window. This keeps the active cell mounted (so focus / keyboard nav work)
 * without forcing every row to widen its column list.
 *
 * Stability: the iterator's identity changes only when the underlying slice
 * does, not when the active position moves — non-active rows pass `-1` and
 * keep their memoized output across active-position changes.
 */
export function useViewportColumns<R>({
  columns,
  colOverscanStartIdx,
  colOverscanEndIdx,
  lastFrozenLeftColumnIndex,
  firstFrozenRightColumnIndex,
}: UseViewportColumnsArgs<R>): UseViewportColumnsResult<R> {
  const iterateOverViewportColumns = useCallback(
    function* (activeColumnIdx: number): Generator<CalculatedColumn<R>> {
      if (columns.length === 0) return;

      // Left-pinned band — always yielded.
      for (let i = 0; i <= lastFrozenLeftColumnIndex; i++) yield columns[i];

      // Active unpinned column that sits *before* the overscan window.
      if (
        activeColumnIdx > lastFrozenLeftColumnIndex &&
        activeColumnIdx < colOverscanStartIdx &&
        activeColumnIdx < firstFrozenRightColumnIndex
      ) {
        yield columns[activeColumnIdx];
      }

      // Unpinned overscan window, clamped to the unpinned band.
      const start = max(colOverscanStartIdx, lastFrozenLeftColumnIndex + 1);
      const end = min(colOverscanEndIdx, firstFrozenRightColumnIndex - 1);
      for (let i = start; i <= end; i++) yield columns[i];

      // Active unpinned column that sits *after* the overscan window.
      if (
        activeColumnIdx > colOverscanEndIdx &&
        activeColumnIdx < firstFrozenRightColumnIndex
      ) {
        yield columns[activeColumnIdx];
      }

      // Right-pinned band — always yielded.
      for (let i = firstFrozenRightColumnIndex; i < columns.length; i++) {
        yield columns[i];
      }
    },
    [
      columns,
      lastFrozenLeftColumnIndex,
      firstFrozenRightColumnIndex,
      colOverscanStartIdx,
      colOverscanEndIdx,
    ],
  );

  const iterateOverViewportColumnsForRow =
    useCallback<IterateOverViewportColumnsForRow<R>>(
      function* (activeColumnIdx, isRowOutsideViewport = false) {
        if (isRowOutsideViewport) {
          if (activeColumnIdx >= 0 && activeColumnIdx < columns.length) {
            yield [columns[activeColumnIdx], true];
          }
          return;
        }
        for (const column of iterateOverViewportColumns(activeColumnIdx)) {
          yield [column, column.idx === activeColumnIdx];
        }
      },
      [columns, iterateOverViewportColumns],
    );

  const viewportColumns = useMemo<readonly CalculatedColumn<R>[]>(
    () => Array.from(iterateOverViewportColumns(-1)),
    [iterateOverViewportColumns],
  );

  return { viewportColumns, iterateOverViewportColumnsForRow };
}
