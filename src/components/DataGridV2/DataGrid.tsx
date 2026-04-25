import { useRef } from "react";

import HeaderRow from "./HeaderRow";
import Row from "./Row";
import { DEFAULT_ROW_HEIGHT } from "./constants";
import {
  useCalculatedColumns,
  useGridDimensions,
  useScrollState,
  useViewportColumns,
  useViewportRows,
} from "./hooks";
import type { DataGridProps } from "./types";
import { classnames } from "./utils";

import dataGridStyles from "./styles/DataGrid.module.css";

/**
 * Layer 3: column freezing.
 *   - Frozen columns are sorted leftmost in `useCalculatedColumns`; their
 *     cumulative left offsets are emitted as `--rdg-frozen-left-N` CSS vars
 *     on the root, and frozen cells consume them via `inset-inline-start:
 *     var(--rdg-frozen-left-N)` together with `position: sticky`.
 *   - Frozen columns are always present in the viewport iteration (see
 *     `useViewportColumns`), so they re-render only when their own props
 *     change — horizontal scrolling does not touch them.
 *   - No frozen-edge shadow in v1 (deferred).
 *
 * Out of scope (by design, landing in later layers):
 *   - Active position iteration of out-of-viewport rows/cols (layer 4).
 *   - Row selection, resize, sort, reorder, expansion (layers 5–9).
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
  const gridRef = useRef<HTMLDivElement>(null);

  const { scrollTop, scrollLeft } = useScrollState(gridRef);
  const [gridWidth, gridHeight] = useGridDimensions(gridRef);

  const {
    columns,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
    templateColumns,
    layoutCssVars,
    colOverscanStartIdx,
    colOverscanEndIdx,
  } = useCalculatedColumns({
    rawColumns,
    scrollLeft,
    viewportWidth: gridWidth,
  });

  const resolvedHeaderRowHeight = headerRowHeight ?? rowHeight;
  const clientHeight = Math.max(0, gridHeight - resolvedHeaderRowHeight);

  const {
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    gridTemplateRows: bodyTemplateRows,
  } = useViewportRows({
    rowCount: rows.length,
    rowHeight,
    clientHeight,
    scrollTop,
  });

  const { viewportColumns } = useViewportColumns({
    columns,
    colOverscanStartIdx,
    colOverscanEndIdx,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
  });

  // Header track is always present; body tracks are only emitted when there
  // are rows (otherwise `repeat(0, …)` would be invalid CSS).
  const gridTemplateRows = `${resolvedHeaderRowHeight}px${bodyTemplateRows}`;

  const viewportRows: React.ReactNode[] = [];
  for (let rowIdx = rowOverscanStartIdx; rowIdx <= rowOverscanEndIdx; rowIdx++) {
    const row = rows[rowIdx];
    viewportRows.push(
      <Row
        key={rowKeyGetter(row)}
        row={row}
        rowIdx={rowIdx}
        // +2 = +1 for 1-based grid lines, +1 to skip the header track.
        gridRowStart={rowIdx + 2}
        columns={viewportColumns}
      />,
    );
  }

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      tabIndex={-1}
      className={classnames(dataGridStyles.root, className)}
      style={
        {
          ...style,
          ...layoutCssVars,
          gridTemplateColumns: templateColumns,
          gridTemplateRows,
          "--rdg-row-height": `${rowHeight}px`,
          "--rdg-header-row-height": `${resolvedHeaderRowHeight}px`,
        } as React.CSSProperties
      }
    >
      <HeaderRow columns={viewportColumns} />
      {viewportRows}
    </div>
  );
}
