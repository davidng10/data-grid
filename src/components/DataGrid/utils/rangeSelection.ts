import type { CellRangeSelection } from "../types";

export function isPointInRange(
  rowIndex: number,
  columnId: string,
  range: CellRangeSelection,
  visualIds: string[],
): boolean {
  const rMin = Math.min(range.anchor.rowIndex, range.focus.rowIndex);
  const rMax = Math.max(range.anchor.rowIndex, range.focus.rowIndex);
  if (rowIndex < rMin || rowIndex > rMax) return false;
  const aIdx = visualIds.indexOf(range.anchor.columnId);
  const fIdx = visualIds.indexOf(range.focus.columnId);
  const cIdx = visualIds.indexOf(columnId);
  if (aIdx < 0 || fIdx < 0 || cIdx < 0) return false;
  const cMin = Math.min(aIdx, fIdx);
  const cMax = Math.max(aIdx, fIdx);
  return cIdx >= cMin && cIdx <= cMax;
}
