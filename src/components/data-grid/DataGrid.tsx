import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Body } from "./Body";
import { Header } from "./Header";
import {
  DEFAULT_MIN_COLUMN_WIDTH,
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
} from "./constants";
import { useGridVirtualizers } from "./useGridVirtualizers";
import type { DataGridProps } from "./types";
import "./DataGrid.css";

export const DataGrid = <TData,>({
  data,
  columns,
  columnPinning,
  onColumnPinningChange,
  columnSizing,
  onColumnSizingChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  className,
  style,
}: DataGridProps<TData>) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnPinning: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: DEFAULT_MIN_COLUMN_WIDTH },
    state: { columnPinning, columnSizing },
    onColumnPinningChange,
    onColumnSizingChange,
  });

  const { rowVirtualizer, columnVirtualizer } = useGridVirtualizers({
    scrollRef,
    table,
    rowCount: data.length,
    rowHeight,
    overscan,
  });

  // Column sizes, pinning offsets, and total width are exposed as CSS custom
  // properties on the scroll container. Cells and the row/body wrappers read
  // width/transform/sticky-offset from these vars rather than from React
  // props — so a resize commit only updates one inline style on this element,
  // and Header/Body/Cell see unchanged props and skip via memo. The browser
  // repaints sizes via CSS inheritance.
  const columnVars = useMemo<Record<string, string>>(() => {
    const vars: Record<string, string> = {};
    let leftTotal = 0;
    for (const col of table.getLeftVisibleLeafColumns()) {
      const size = col.getSize();
      vars[`--dg-col-${col.id}-size`] = `${size}px`;
      vars[`--dg-col-${col.id}-pinned-left`] = `${leftTotal}px`;
      leftTotal += size;
    }
    let centerTotal = 0;
    for (const col of table.getCenterVisibleLeafColumns()) {
      const size = col.getSize();
      vars[`--dg-col-${col.id}-size`] = `${size}px`;
      vars[`--dg-col-${col.id}-start`] = `${centerTotal}px`;
      centerTotal += size;
    }
    const rightCols = table.getRightVisibleLeafColumns();
    let rightTotal = 0;
    for (let i = rightCols.length - 1; i >= 0; i--) {
      const col = rightCols[i];
      const size = col.getSize();
      vars[`--dg-col-${col.id}-size`] = `${size}px`;
      vars[`--dg-col-${col.id}-pinned-right`] = `${rightTotal}px`;
      rightTotal += size;
    }
    vars["--dg-left-total"] = `${leftTotal}px`;
    vars["--dg-total-width"] = `${leftTotal + centerTotal + rightTotal}px`;
    return vars;
    // table itself is unstable across renders (TanStack Table's design); we
    // depend on the state slices that drive the computed sizes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing, columnPinning, columns]);

  // Skip virtualizer cache invalidation while the user is mid-drag. Per-frame
  // measure() calls would invalidate the column virtualizer's getVirtualItems
  // result on every mousemove, defeating Body/Header memo. Default overscan
  // (12 cols) masks the visibility staleness; on mouseup, isResizingColumn
  // flips to null, this effect re-runs, and the cache is rebuilt once.
  const isResizing = Boolean(table.getState().columnSizingInfo.isResizingColumn);
  useEffect(() => {
    if (isResizing) return;
    columnVirtualizer.measure();
  }, [columnSizing, isResizing, columnVirtualizer]);

  const resizeEnabled = Boolean(onColumnSizingChange);

  const containerStyle: CSSProperties = {
    ...(columnVars as CSSProperties),
    ...style,
  };

  // Stable derivations passed to memoized Header/Body. These are TanStack
  // Table / Virtual outputs that only change on relevant state shifts (data,
  // visibility, scroll), not on column sizing alone.
  const rows = table.getRowModel().rows;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  const bodyHeight = rowVirtualizer.getTotalSize();
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();

  return (
    <div
      ref={scrollRef}
      className={className ? `dg-container ${className}` : "dg-container"}
      style={containerStyle}
    >
      <Header
        leftHeaderGroups={leftHeaderGroups}
        centerHeaderGroups={centerHeaderGroups}
        rightHeaderGroups={rightHeaderGroups}
        virtualColumns={virtualColumns}
        height={rowHeight}
        resizeEnabled={resizeEnabled}
      />
      <Body
        rows={rows}
        virtualRows={virtualRows}
        virtualColumns={virtualColumns}
        bodyHeight={bodyHeight}
        columnPinning={columnPinning}
      />
    </div>
  );
};
