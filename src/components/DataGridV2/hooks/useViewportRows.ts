import { useMemo } from "react";

import { ROW_OVERSCAN } from "../constants";

const { floor, max, min } = Math;

/**
 * Layer-9 (`useExpansion`) plugs in here. When provided, every row at an
 * expanded index contributes an extra `detailHeight` to all rows that follow.
 * The shape is closed-form so `getRowTop` stays O(log E) and `findRowIdx`
 * stays O(log N · log E).
 *
 * In layer 2 this is always `undefined`, which collapses the math to the
 * trivial fixed-row-height path.
 */
export interface ExpansionState {
  readonly detailHeight: number;
  readonly expandedCount: number;
  /** Sorted ascending. Used by `countExpandedBefore`'s lower-bound search. */
  readonly expandedIndicesSorted: readonly number[];
  /** O(log E) lower-bound on `expandedIndicesSorted`. */
  readonly countExpandedBefore: (rowIdx: number) => number;
}

interface UseViewportRowsArgs {
  readonly rowCount: number;
  readonly rowHeight: number;
  readonly clientHeight: number;
  readonly scrollTop: number;
  readonly expansion?: ExpansionState;
}

export interface UseViewportRowsResult {
  readonly rowOverscanStartIdx: number;
  readonly rowOverscanEndIdx: number;
  readonly totalRowHeight: number;
  /**
   * The body portion of `grid-template-rows` (excludes the header track).
   * Caller prepends `${headerRowHeight}px ` to form the final root template.
   * Leading space is intentional so concatenation reads cleanly.
   */
  readonly gridTemplateRows: string;
  readonly getRowTop: (rowIdx: number) => number;
  readonly findRowIdx: (offset: number) => number;
}

export function useViewportRows({
  rowCount,
  rowHeight,
  clientHeight,
  scrollTop,
  expansion,
}: UseViewportRowsArgs): UseViewportRowsResult {
  const { totalRowHeight, gridTemplateRows, getRowTop, findRowIdx } = useMemo(
    () => buildRowGeometry(rowCount, rowHeight, expansion),
    [rowCount, rowHeight, expansion],
  );

  if (rowCount === 0) {
    return {
      rowOverscanStartIdx: 0,
      rowOverscanEndIdx: -1,
      totalRowHeight: 0,
      gridTemplateRows: "",
      getRowTop,
      findRowIdx,
    };
  }

  const rowVisibleStartIdx = findRowIdx(scrollTop);
  const rowVisibleEndIdx = findRowIdx(scrollTop + clientHeight);

  const rowOverscanStartIdx = max(0, rowVisibleStartIdx - ROW_OVERSCAN);
  const rowOverscanEndIdx = min(rowCount - 1, rowVisibleEndIdx + ROW_OVERSCAN);

  return {
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    totalRowHeight,
    gridTemplateRows,
    getRowTop,
    findRowIdx,
  };
}

function buildRowGeometry(
  rowCount: number,
  rowHeight: number,
  expansion: ExpansionState | undefined,
): {
  totalRowHeight: number;
  gridTemplateRows: string;
  getRowTop: (rowIdx: number) => number;
  findRowIdx: (offset: number) => number;
} {
  // Fast path — no expansion or zero expansions. This is layer 2's only path
  // until layer 9 lands; the closed-form math stays trivial because every row
  // contributes the same height.
  if (expansion === undefined || expansion.expandedCount === 0) {
    const totalRowHeight = rowCount * rowHeight;
    const gridTemplateRows =
      rowCount > 0 ? ` repeat(${rowCount}, ${rowHeight}px)` : "";
    return {
      totalRowHeight,
      gridTemplateRows,
      getRowTop: (rowIdx: number) => rowIdx * rowHeight,
      findRowIdx: (offset: number) => {
        if (offset <= 0) return 0;
        return min(rowCount - 1, max(0, floor(offset / rowHeight)));
      },
    };
  }

  // Expansion-aware path. Activated by layer 9. Kept here so layer 9 only has
  // to wire `useExpansion` into `DataGrid.tsx`; the geometry math doesn't move.
  const { detailHeight, expandedCount, countExpandedBefore } = expansion;
  const totalRowHeight = rowCount * rowHeight + expandedCount * detailHeight;

  function getRowTop(rowIdx: number): number {
    return rowIdx * rowHeight + detailHeight * countExpandedBefore(rowIdx);
  }

  function findRowIdx(offset: number): number {
    if (offset <= 0) return 0;
    if (offset >= totalRowHeight) return rowCount - 1;
    // Bisect: find the largest i with getRowTop(i) <= offset. If `offset`
    // falls inside row i's detail panel, getRowTop(i+1) > offset, so we
    // correctly resolve to the data-row whose detail panel it is.
    let lo = 0;
    let hi = rowCount - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (getRowTop(mid) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // Build the interleaved track string with run-length compression. Walking
  // is O(N + E); the compression keeps the output string short even at
  // 1M rows + 100 expansions (~one repeat() per non-detail run).
  const tracks: string[] = [];
  let runHeight: number | null = null;
  let runCount = 0;
  const flushRun = () => {
    if (runCount === 0) return;
    tracks.push(
      runCount > 1 ? `repeat(${runCount}, ${runHeight}px)` : `${runHeight}px`,
    );
    runHeight = null;
    runCount = 0;
  };
  const pushTrack = (height: number) => {
    if (runHeight === height) {
      runCount++;
    } else {
      flushRun();
      runHeight = height;
      runCount = 1;
    }
  };
  for (let i = 0; i < rowCount; i++) {
    pushTrack(rowHeight);
    if (countExpandedBefore(i + 1) > countExpandedBefore(i)) {
      pushTrack(detailHeight);
    }
  }
  flushRun();
  const gridTemplateRows = tracks.length > 0 ? ` ${tracks.join(" ")}` : "";

  return { totalRowHeight, gridTemplateRows, getRowTop, findRowIdx };
}
