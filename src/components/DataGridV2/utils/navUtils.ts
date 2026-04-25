import type { Position } from "../types";

interface CanExitGridArgs {
  readonly maxColIdx: number;
  readonly activePosition: Position;
  readonly shiftKey: boolean;
}

/**
 * Tab semantics for layer 4: there is no `CHANGE_ROW` mode, so Tab does not
 * wrap from end-of-row into the next row. The PLAN's "Tab exits on last cell"
 * rule is implemented as: Tab from any cell at `idx === maxColIdx` allows
 * focus to escape the grid; Shift+Tab from any cell at `idx === 0` does the
 * same on the inline-start side. This avoids trapping focus at the right
 * edge of non-last rows now that wrapping is off.
 */
export function canExitGrid({
  maxColIdx,
  activePosition: { idx },
  shiftKey,
}: CanExitGridArgs): boolean {
  return shiftKey ? idx <= 0 : idx >= maxColIdx;
}

interface GetNextPositionArgs {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly activePosition: Position;
  readonly maxColIdx: number;
  readonly minRowIdx: number;
  readonly maxRowIdx: number;
  readonly clientHeight: number;
  readonly rowHeight: number;
}

/**
 * Pure mapping from "active position + key" to the next active position.
 * Returns the same {@link Position} reference when the key would not move
 * focus (e.g. ArrowUp at the header row), so callers can short-circuit.
 *
 * `PageUp`/`PageDown` use `clientHeight / rowHeight` for the page step. This
 * is exact under fixed row heights (layer 2). Once layer 9 lands, the
 * expansion-aware variant should switch to `findRowIdx(getRowTop(rowIdx) ±
 * clientHeight)` so detail panels are skipped correctly.
 */
export function getNextPosition({
  key,
  ctrlKey,
  shiftKey,
  activePosition,
  maxColIdx,
  minRowIdx,
  maxRowIdx,
  clientHeight,
  rowHeight,
}: GetNextPositionArgs): Position {
  const { idx, rowIdx } = activePosition;

  switch (key) {
    case "ArrowUp":
      return rowIdx > minRowIdx ? { idx, rowIdx: rowIdx - 1 } : activePosition;
    case "ArrowDown":
      return rowIdx < maxRowIdx ? { idx, rowIdx: rowIdx + 1 } : activePosition;
    case "ArrowLeft":
      return idx > 0 ? { idx: idx - 1, rowIdx } : activePosition;
    case "ArrowRight":
      return idx < maxColIdx ? { idx: idx + 1, rowIdx } : activePosition;
    case "Tab":
      // Caller is responsible for the canExitGrid check; if we reach here the
      // tab stays inside the grid, so just nudge the column.
      return { idx: idx + (shiftKey ? -1 : 1), rowIdx };
    case "Home":
      return ctrlKey ? { idx: 0, rowIdx: minRowIdx } : { idx: 0, rowIdx };
    case "End":
      return ctrlKey
        ? { idx: maxColIdx, rowIdx: maxRowIdx }
        : { idx: maxColIdx, rowIdx };
    case "PageUp": {
      if (rowIdx === minRowIdx) return activePosition;
      const pageStep = Math.max(1, Math.floor(clientHeight / rowHeight));
      return { idx, rowIdx: Math.max(minRowIdx, rowIdx - pageStep) };
    }
    case "PageDown": {
      if (rowIdx === maxRowIdx) return activePosition;
      const pageStep = Math.max(1, Math.floor(clientHeight / rowHeight));
      return { idx, rowIdx: Math.min(maxRowIdx, rowIdx + pageStep) };
    }
    default:
      return activePosition;
  }
}

export function isSamePosition(a: Position, b: Position): boolean {
  return a.idx === b.idx && a.rowIdx === b.rowIdx;
}
