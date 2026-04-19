import type { CellRangeSelection } from "../types";

// Pure decision for the visibility-reconcile effect in DataGrid.tsx.
// Returns true if the current range spans a column that just became hidden
// (either an endpoint or any column inside the rectangle). Kept separate from
// the effect so it's trivially testable and so the effect body stays small.
export function shouldClearRangeForVisibilityChange(
  prevVisualIds: string[],
  nextVisualIds: string[],
  range: CellRangeSelection | null,
): boolean {
  if (!range) return false;

  const nextSet = new Set(nextVisualIds);
  if (!nextSet.has(range.anchor.columnId)) return true;
  if (!nextSet.has(range.focus.columnId)) return true;

  const aIdx = prevVisualIds.indexOf(range.anchor.columnId);
  const fIdx = prevVisualIds.indexOf(range.focus.columnId);
  // Range endpoints weren't in prev — nothing to reconcile against. This
  // shouldn't normally happen; fail-open.
  if (aIdx < 0 || fIdx < 0) return false;

  const lo = Math.min(aIdx, fIdx);
  const hi = Math.max(aIdx, fIdx);
  for (let i = lo; i <= hi; i++) {
    if (!nextSet.has(prevVisualIds[i])) return true;
  }
  return false;
}
