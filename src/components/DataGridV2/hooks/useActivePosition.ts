import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import type { Position } from "../types";
import { focusCell } from "../utils";

export interface ActivePosition extends Position {
  readonly mode: "ACTIVE";
}

interface UseActivePositionArgs {
  readonly gridRef: RefObject<HTMLDivElement | null>;
  /** Highest valid `idx`. `columns.length - 1`. */
  readonly maxColIdx: number;
  /** Lowest valid `rowIdx` — `-1` (header) when there are columns. */
  readonly minRowIdx: number;
  /** Highest valid `rowIdx` — `rows.length - 1`, or `-1` if there are no rows. */
  readonly maxRowIdx: number;
}

export interface UseActivePositionResult {
  readonly activePosition: ActivePosition;
  readonly setActivePosition: (position: ActivePosition) => void;
  /**
   * Setting this triggers a layout effect that scrolls + focuses the cell at
   * the given position. Mousedown-set-active deliberately does *not* call
   * this — the browser already focuses on click. Keyboard nav uses it.
   */
  readonly setPositionToFocus: (position: ActivePosition | null) => void;
  readonly validatePosition: (position: Position) => ValidatedPosition;
  readonly isActiveInBounds: boolean;
}

interface ValidatedPosition {
  readonly isInActiveBounds: boolean;
  readonly isCellInViewport: boolean;
  readonly isHeader: boolean;
}

const initialActivePosition: ActivePosition = {
  idx: -1,
  // -Infinity (rather than -1) keeps the initial state distinguishable from
  // "header cell at idx 0". The validation pass treats it as out-of-bounds
  // until the first explicit setActivePosition call.
  rowIdx: Number.NEGATIVE_INFINITY,
  mode: "ACTIVE",
};

/**
 * Owns the grid's active-cell coordinate. Two state slots:
 *
 *  - `activePosition` — what is *selected* (drives `aria-selected`, the
 *    roving tab-index, and the visual focus ring).
 *  - `positionToFocus` — what the layout effect should *focus + scroll into
 *    view* on the next commit. Decoupling these lets a mousedown-driven
 *    selection avoid stealing focus (the browser focuses the clicked cell
 *    natively) while keyboard nav explicitly opts in.
 *
 * In-render reset: if a prior `activePosition` falls out of the current
 * bounds (the consumer shrunk the data), reset to the initial position
 * during render so the next paint reflects the new state without an
 * additional commit.
 */
export function useActivePosition({
  gridRef,
  maxColIdx,
  minRowIdx,
  maxRowIdx,
}: UseActivePositionArgs): UseActivePositionResult {
  const [activePosition, setActivePosition] =
    useState<ActivePosition>(initialActivePosition);
  const [positionToFocus, setPositionToFocus] = useState<ActivePosition | null>(
    null,
  );
  // Track which positionToFocus we've already focused. Without this, a
  // suspense fallback / hidden Activity remount would re-focus the cell
  // unnecessarily on every layout effect run.
  const focusedRef = useRef<ActivePosition | null>(null);

  function validatePosition({ idx, rowIdx }: Position): ValidatedPosition {
    const isColInBounds = idx >= 0 && idx <= maxColIdx;
    const isRowInActiveBounds = rowIdx >= minRowIdx && rowIdx <= maxRowIdx;
    const isRowInViewport = rowIdx >= 0 && rowIdx <= maxRowIdx;
    return {
      isInActiveBounds: isColInBounds && isRowInActiveBounds,
      isCellInViewport: isColInBounds && isRowInViewport,
      isHeader: isColInBounds && rowIdx === -1,
    };
  }

  let resolvedPosition = activePosition;
  let validated = validatePosition(resolvedPosition);

  // Sync-during-render reset: if the active cell fell out of bounds (rows
  // removed, columns removed), drop back to the initial position. React 18
  // tolerates a setState during render as long as the update is to the
  // current component; the next commit reflects the corrected state.
  if (
    !validated.isInActiveBounds &&
    resolvedPosition !== initialActivePosition
  ) {
    setActivePosition(initialActivePosition);
    setPositionToFocus(null);
    resolvedPosition = initialActivePosition;
    validated = validatePosition(resolvedPosition);
  }

  useLayoutEffect(() => {
    if (positionToFocus === null) return;
    if (positionToFocus === focusedRef.current) return;
    focusedRef.current = positionToFocus;
    const gridEl = gridRef.current;
    if (gridEl !== null) focusCell(gridEl);
  }, [positionToFocus, gridRef]);

  return {
    activePosition: resolvedPosition,
    setActivePosition,
    setPositionToFocus,
    validatePosition,
    isActiveInBounds: validated.isInActiveBounds,
  };
}
