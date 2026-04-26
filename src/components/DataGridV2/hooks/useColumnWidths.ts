import { useState } from "react";
import { flushSync } from "react-dom";

import { useLatestFunc } from "./useLatestFunc";

interface UseColumnWidthsArgs {
  /**
   * Consumer callback. Fires once per pointer-move tick after the internal
   * width state has committed. Identity may change across renders — wrapped
   * with `useLatestFunc` internally so the returned handler stays stable.
   */
  readonly onColumnResize:
    | ((columnKey: string, width: number) => void)
    | undefined;
}

export interface UseColumnWidthsResult {
  /**
   * Map of `columnKey → resized width (px)`. Absent → fall back to the
   * column's configured `width` (default `'auto'`). Identity changes only on
   * resize, so consumers that depend on it (e.g. `useCalculatedColumns`'
   * metrics pass) re-run only when widths actually change.
   */
  readonly resizedWidths: ReadonlyMap<string, number>;
  /**
   * Stable identity. Receives a column key + new width (assumed clamped by
   * the caller — `HeaderCell` does the clamp where it has the `Column`
   * reference). Wraps the state update in `flushSync` so the new width lands
   * in the same paint as the pointer-move event that produced it.
   */
  readonly handleColumnResize: (columnKey: string, width: number) => void;
}

/**
 * Owns the user-driven column-width override map. Layer 6.
 *
 *   - Keyed by `column.key` (not index) so reorder / dataset swaps preserve
 *     resized widths as long as the same key exists in the new column set.
 *   - `flushSync`-wrapped commit: pointer-move fires at up to 240Hz; without
 *     `flushSync` React batches state updates and the user sees stale widths
 *     between frames. Forcing a sync commit lands the new template-columns in
 *     the same paint as the pointermove that produced it.
 *   - Identity of `handleColumnResize` is stable across renders so memoised
 *     `HeaderCell`s don't invalidate when the consumer's `onColumnResize`
 *     prop identity changes.
 */
export function useColumnWidths({
  onColumnResize,
}: UseColumnWidthsArgs): UseColumnWidthsResult {
  const [resizedWidths, setResizedWidths] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  const handleColumnResize = useLatestFunc(
    (columnKey: string, width: number) => {
      flushSync(() => {
        setResizedWidths((prev) => {
          if (prev.get(columnKey) === width) return prev;
          const next = new Map(prev);
          next.set(columnKey, width);
          return next;
        });
      });
      onColumnResize?.(columnKey, width);
    },
  );

  return { resizedWidths, handleColumnResize };
}
