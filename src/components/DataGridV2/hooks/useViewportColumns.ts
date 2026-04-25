import { useMemo } from "react";

import type { CalculatedColumn } from "../types";

const { max, min } = Math;

interface UseViewportColumnsArgs<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  readonly colOverscanStartIdx: number;
  readonly colOverscanEndIdx: number;
  readonly lastFrozenLeftColumnIndex: number;
  readonly firstFrozenRightColumnIndex: number;
}

export interface UseViewportColumnsResult<R> {
  /**
   * `[...left-pinned, ...overscan, ...right-pinned]`. Both pinned bands are
   * always present in the slice; the overscan window slides through the
   * unpinned band as the grid scrolls horizontally.
   *
   * Layer 4 will replace this with a generator that can additionally yield
   * the active column when it is outside the overscan window. For layer 2
   * the active position doesn't exist yet so a flat array is sufficient.
   */
  readonly viewportColumns: readonly CalculatedColumn<R>[];
}

export function useViewportColumns<R>({
  columns,
  colOverscanStartIdx,
  colOverscanEndIdx,
  lastFrozenLeftColumnIndex,
  firstFrozenRightColumnIndex,
}: UseViewportColumnsArgs<R>): UseViewportColumnsResult<R> {
  const viewportColumns = useMemo<readonly CalculatedColumn<R>[]>(() => {
    if (columns.length === 0) return columns;

    const result: CalculatedColumn<R>[] = [];
    // Left-pinned band: always present.
    for (let i = 0; i <= lastFrozenLeftColumnIndex; i++) {
      result.push(columns[i]);
    }
    // Unpinned overscan window, clamped to the unpinned band so we never
    // emit a pinned column twice.
    const start = max(colOverscanStartIdx, lastFrozenLeftColumnIndex + 1);
    const end = min(colOverscanEndIdx, firstFrozenRightColumnIndex - 1);
    for (let i = start; i <= end; i++) {
      result.push(columns[i]);
    }
    // Right-pinned band: always present.
    for (let i = firstFrozenRightColumnIndex; i < columns.length; i++) {
      result.push(columns[i]);
    }
    return result;
  }, [
    columns,
    colOverscanStartIdx,
    colOverscanEndIdx,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
  ]);

  return { viewportColumns };
}
