import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Body } from "./components/Body";
import { Header } from "./components/header/Header";
import {
  DEFAULT_MIN_COLUMN_WIDTH,
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
} from "./constants";
import { useGridVirtualizers } from "./useGridVirtualizers";
import { useCellNavigation } from "./useCellNavigation";
import type { DataGridProps } from "./types";
import "./DataGrid.css";

export const DataGrid = <TData,>({
  data,
  columns,
  columnOrder,
  columnSizing,
  columnPinning,
  onColumnOrderChange,
  onColumnSizingChange,
  onColumnPinningChange,
  onCellChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  className,
  style,
}: DataGridProps<TData>) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const onCellChangeRef = useRef(onCellChange);
  useEffect(() => {
    onCellChangeRef.current = onCellChange;
  }, [onCellChange]);

  const meta = useMemo(
    () => ({
      updateData: (rowIndex: number, columnId: string, value: unknown) =>
        onCellChangeRef.current?.(rowIndex, columnId, value),
    }),
    [],
  );

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
    meta,
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

  const containerStyle: CSSProperties = useMemo(() => {
    return {
      ...(columnVars as CSSProperties),
      ...style,
    };
  }, [columnVars, style]);

  const bodyHeight = rowVirtualizer.getTotalSize();
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const rows = table.getRowModel().rows;
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Counts used by keyboard nav for clamping + zone math. Recomputed when
  // pinning/order/columns change — same dep set as columnVars above.
  const leafCounts = useMemo(() => {
    const left = table.getLeftVisibleLeafColumns().length;
    const center = table.getCenterVisibleLeafColumns().length;
    const right = table.getRightVisibleLeafColumns().length;
    return { left, center, right, total: left + center + right };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnPinning, columnOrder, columns]);

  const centerColumnIds = useMemo(
    () => table.getCenterVisibleLeafColumns().map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnPinning, columnOrder, columns],
  );

  const configIdentity = useMemo(() => {
    return JSON.stringify({ columnPinning, columnOrder });
  }, [columnPinning, columnOrder]);

  const {
    store: selectionStore,
    onPointerDown,
    onKeyDown,
  } = useCellNavigation({
    scrollRef,
    table,
    rowCount: data.length,
    rowHeight,
    leafCounts,
    configIdentity,
  });

  // Commit on drop, not during drag.
  // Live-commit on dragOver costs too much FPS.
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
      tabIndex={0}
      ref={scrollRef}
      className={className ? `dg-container ${className}` : "dg-container"}
      style={containerStyle}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      <Header
        height={rowHeight}
        resizeEnabled={resizeEnabled}
        reorderEnabled={reorderEnabled}
        virtualColumns={virtualColumns}
        centerColumnIds={centerColumnIds}
        leftHeaderGroups={leftHeaderGroups}
        rightHeaderGroups={rightHeaderGroups}
        centerHeaderGroups={centerHeaderGroups}
      />
      <Body
        rows={rows}
        bodyHeight={bodyHeight}
        virtualRows={virtualRows}
        virtualColumns={virtualColumns}
        configIdentity={configIdentity}
        store={selectionStore}
      />
    </div>
  );

  if (!reorderEnabled) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {grid}
    </DndContext>
  );
};
