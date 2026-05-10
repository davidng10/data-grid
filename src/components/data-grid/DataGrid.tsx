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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import {
  getCoreRowModel,
  useReactTable,
  type RowData,
} from "@tanstack/react-table";

import { GridContent } from "./components/GridContent";
import {
  DEFAULT_MIN_COLUMN_WIDTH,
  DEFAULT_ROW_OVERSCAN,
  DEFAULT_COLUMN_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
} from "./constants";
import { useCellNavigation } from "./hooks/useCellNavigation";
import type { DataGridProps } from "./types";
import "./DataGrid.css";

export const DataGrid = <TData extends RowData>({
  data,
  columns,
  getRowId,
  columnOrder,
  columnSizing,
  columnPinning,
  onColumnOrderChange,
  onColumnSizingChange,
  onColumnPinningChange,
  onCellChange,
  rowHeight = DEFAULT_ROW_HEIGHT,
  rowOverscan = DEFAULT_ROW_OVERSCAN,
  columnOverscan = DEFAULT_COLUMN_OVERSCAN,
  className,
  style,
}: DataGridProps<TData>) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusGrid = useCallback(() => {
    // Commit/cancel starts from the editor's key/blur handler. Defer focus until
    // that handler and the editor unmount finish, otherwise input or AntD focus
    // cleanup can win the race and leave keyboard navigation attached to body.
    queueMicrotask(() => {
      const grid = scrollRef.current;
      if (!grid) return;
      const activeElement = grid.ownerDocument.activeElement;
      if (
        activeElement &&
        activeElement !== grid.ownerDocument.body &&
        !grid.contains(activeElement)
      ) {
        return;
      }
      grid.focus({ preventScroll: true });
    });
  }, []);

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
    getRowId,
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
    // TanStack's table instance is stable while its getters read latest state;
    // these state slices are the layout invalidation tokens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing, columnPinning, columnOrder, columns]);

  const resizeEnabled = Boolean(onColumnSizingChange);
  const reorderEnabled = Boolean(onColumnOrderChange);

  const containerStyle: CSSProperties = useMemo(() => {
    return {
      ...(columnVars as CSSProperties),
      ...style,
    };
  }, [columnVars, style]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const visibleColumnIds = useMemo(() => {
    const left = table.getLeftVisibleLeafColumns().map((c) => c.id);
    const center = table.getCenterVisibleLeafColumns().map((c) => c.id);
    const right = table.getRightVisibleLeafColumns().map((c) => c.id);
    return {
      left,
      center,
      right,
      all: [...left, ...center, ...right],
    };
    // See columnVars above for why table is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnPinning, columnOrder, columns]);

  const columnLayoutIdentity = useMemo(() => {
    return JSON.stringify(visibleColumnIds);
  }, [visibleColumnIds]);

  const {
    store: selectionStore,
    onPointerDown,
    onDoubleClick,
    onKeyDown,
  } = useCellNavigation({
    scrollRef,
    table,
    rowCount: data.length,
    rowHeight,
    visibleColumnIds: visibleColumnIds.all,
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
      onDoubleClick={onDoubleClick}
    >
      <GridContent
        table={table}
        scrollRef={scrollRef}
        rowCount={data.length}
        rowHeight={rowHeight}
        rowOverscan={rowOverscan}
        columnOverscan={columnOverscan}
        columnSizing={columnSizing}
        centerColumnIds={visibleColumnIds.center}
        columnLayoutIdentity={columnLayoutIdentity}
        selectionStore={selectionStore}
        focusGrid={focusGrid}
        resizeEnabled={resizeEnabled}
        reorderEnabled={reorderEnabled}
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
