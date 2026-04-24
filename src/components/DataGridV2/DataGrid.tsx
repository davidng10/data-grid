import HeaderRow from "./HeaderRow";
import Row from "./Row";
import { DEFAULT_ROW_HEIGHT } from "./constants";
import { useCalculatedColumns } from "./hooks";
import type { DataGridProps } from "./types";
import { classnames } from "./utils";

import dataGridStyles from "./styles/DataGrid.module.css";

/**
 * Layer 1: static layout.
 *   - Root CSS grid with gridTemplateColumns computed from column specs.
 *   - Header row + all data rows rendered (no virtualization).
 *   - Every row/cell is memoized; re-renders only propagate when the row,
 *     column, or rowIdx prop identity changes.
 *
 * Out of scope (by design, landing in later layers):
 *   - Virtualization (layer 2)
 *   - Frozen-column sticky behaviour (layer 3 — sort order is in place now)
 *   - Keyboard nav, selection, resize, sort, reorder, expansion (layers 4–9).
 */
export function DataGrid<R>({
  columns: rawColumns,
  rows,
  rowKeyGetter,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerRowHeight,
  className,
  style,
  "aria-label": ariaLabel,
}: DataGridProps<R>) {
  const { columns, templateColumns } = useCalculatedColumns(rawColumns);

  const resolvedHeaderRowHeight = headerRowHeight ?? rowHeight;
  // Grid row tracks: one for the header, then N for data rows.
  // `repeat(N, H)` collapses the string for large N (spec: millions of rows).
  const gridTemplateRows =
    rows.length > 0
      ? `${resolvedHeaderRowHeight}px repeat(${rows.length}, ${rowHeight}px)`
      : `${resolvedHeaderRowHeight}px`;

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      tabIndex={-1}
      className={classnames(dataGridStyles.root, className)}
      style={{
        ...style,
        gridTemplateColumns: templateColumns,
        gridTemplateRows,
        "--rdg-row-height": `${rowHeight}px`,
        "--rdg-header-row-height": `${resolvedHeaderRowHeight}px`,
      } as React.CSSProperties}
    >
      <HeaderRow columns={columns} />
      {rows.map((row, rowIdx) => (
        <Row
          key={rowKeyGetter(row)}
          row={row}
          rowIdx={rowIdx}
          // +2 = +1 for 1-based grid lines, +1 to skip the header track.
          gridRowStart={rowIdx + 2}
          columns={columns}
        />
      ))}
    </div>
  );
}
