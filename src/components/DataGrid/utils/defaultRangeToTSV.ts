import type { CellRange, DataGridColumnDef } from "../types";

// Replace any embedded tab / CR / LF with a single space so the TSV stays
// parseable in Excel / Google Sheets (those characters are TSV delimiters
// and would silently shred the layout).
const WHITESPACE_RE = /[\t\r\n]+/g;

function coerceCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((v) => coerceCell(v))
      .join(", ")
      .replace(WHITESPACE_RE, " ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).replace(WHITESPACE_RE, " ");
    } catch {
      return String(value).replace(WHITESPACE_RE, " ");
    }
  }
  return String(value).replace(WHITESPACE_RE, " ");
}

// Default TSV serializer for a cell range. Pure function — consumer wires it
// inside their `onRangeCopy` (or doesn't, if they want a different format).
//
// `columns` must already be filtered to the visible columns the range covers,
// in current visual order (left pinned → middle → right pinned). The grid
// builds this when it calls `onRangeCopy`.
export function defaultRangeToTSV<TRow>(
  range: CellRange,
  getCellValue: (rowIndex: number, columnId: string) => unknown,
  columns: DataGridColumnDef<TRow>[],
): string {
  const rMin = Math.min(range.anchor.rowIndex, range.focus.rowIndex);
  const rMax = Math.max(range.anchor.rowIndex, range.focus.rowIndex);

  const rows: string[] = [];
  for (let r = rMin; r <= rMax; r++) {
    const cells: string[] = [];
    for (const col of columns) {
      cells.push(coerceCell(getCellValue(r, col.id)));
    }
    rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}
