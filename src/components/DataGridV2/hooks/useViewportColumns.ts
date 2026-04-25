import { useMemo } from "react";

import type { CalculatedColumn } from "../types";

const { max } = Math;

interface UseViewportColumnsArgs<R> {
  readonly columns: readonly CalculatedColumn<R>[];
  readonly colOverscanStartIdx: number;
  readonly colOverscanEndIdx: number;
  readonly lastFrozenColumnIndex: number;
}

export interface UseViewportColumnsResult<R> {
  /**
   * `[...frozen, ...overscan]`. Frozen columns are always present in the
   * slice; the overscan window slides as the grid scrolls horizontally.
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
  lastFrozenColumnIndex,
}: UseViewportColumnsArgs<R>): UseViewportColumnsResult<R> {
  const viewportColumns = useMemo<readonly CalculatedColumn<R>[]>(() => {
    if (columns.length === 0) return columns;

    const result: CalculatedColumn<R>[] = [];
    for (let i = 0; i <= lastFrozenColumnIndex; i++) {
      result.push(columns[i]);
    }

    if (columns.length === lastFrozenColumnIndex + 1) return result;

    const start = max(colOverscanStartIdx, lastFrozenColumnIndex + 1);
    for (let i = start; i <= colOverscanEndIdx; i++) {
      result.push(columns[i]);
    }
    return result;
  }, [columns, colOverscanStartIdx, colOverscanEndIdx, lastFrozenColumnIndex]);

  return { viewportColumns };
}
