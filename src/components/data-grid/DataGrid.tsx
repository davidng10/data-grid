import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
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

// Inline rather than pulling in @dnd-kit/modifiers for one trivial fn. Locks
// the dragged column's transform to the horizontal axis so vertical cursor
// drift doesn't visibly tilt the floating header.
const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});

export const DataGrid = <TData,>({
  data,
  columns,
  columnPinning,
  onColumnPinningChange,
  columnSizing,
  onColumnSizingChange,
  columnOrder,
  onColumnOrderChange,
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
    state: { columnPinning, columnSizing, columnOrder },
    onColumnPinningChange,
    onColumnSizingChange,
    onColumnOrderChange,
  });

  const { rowVirtualizer, columnVirtualizer } = useGridVirtualizers({
    scrollRef,
    table,
    rowCount: data.length,
    rowHeight,
    overscan,
  });

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
    // depend on the state slices that drive the computed sizes/order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing, columnPinning, columnOrder, columns]);

  const isResizing = Boolean(
    table.getState().columnSizingInfo.isResizingColumn,
  );
  useEffect(() => {
    if (isResizing) return;
    columnVirtualizer.measure();
  }, [columnSizing, isResizing, columnVirtualizer]);

  const resizeEnabled = Boolean(onColumnSizingChange);
  const reorderEnabled = Boolean(onColumnOrderChange);

  const containerStyle: CSSProperties = {
    ...(columnVars as CSSProperties),
    ...style,
  };

  const rows = table.getRowModel().rows;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  const bodyHeight = rowVirtualizer.getTotalSize();
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();

  const centerColumnIds = useMemo(
    () => table.getCenterVisibleLeafColumns().map((c) => c.id),
    // Same dependency story as columnVars: the table instance itself is
    // unstable; the state slices that determine the center zone aren't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPinning, columnOrder, columns],
  );

  // 5px activation distance: a click on the header content area (e.g. a
  // future sort or just dead space) doesn't get hijacked into a drag, and
  // pointerdown on the resize handle / dropdown trigger is a non-issue
  // anyway because those nodes sit outside the activator ref (the content
  // span). KeyboardSensor intentionally omitted — see limitations.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Commit on drop, not during drag. dnd-kit's horizontalListSortingStrategy
  // handles in-flight visual feedback (non-dragged cells slide out of the
  // way, dragged cell tracks the cursor). columnOrder updates once on
  // mouseup; the CSS-var dictionary recomputes and cells settle into their
  // new positions. Live-commit on dragOver was tried first and double-applies
  // transforms with the strategy. arrayMove operates on the full columnOrder
  // so pinned columns retain their array positions (visual position is
  // driven by columnPinning, not by index here).
  const handleDragEnd = (event: DragEndEvent) => {
    if (!onColumnOrderChange) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current =
      table.getState().columnOrder.length > 0
        ? table.getState().columnOrder
        : table.getAllLeafColumns().map((c) => c.id);
    const oldIdx = current.indexOf(String(active.id));
    const newIdx = current.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
    onColumnOrderChange(arrayMove(current, oldIdx, newIdx));
  };

  const grid = (
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
        reorderEnabled={reorderEnabled}
        centerColumnIds={centerColumnIds}
      />
      <Body
        rows={rows}
        virtualRows={virtualRows}
        virtualColumns={virtualColumns}
        bodyHeight={bodyHeight}
        columnPinning={columnPinning}
        columnOrder={columnOrder}
      />
    </div>
  );

  if (!reorderEnabled) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      {grid}
    </DndContext>
  );
};
