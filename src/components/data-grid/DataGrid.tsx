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
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import { useGridSelection } from "./useGridSelection";
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

  const selectionStore = useGridSelection();

  // Counts used by keyboard nav for clamping + zone math. Recomputed when
  // pinning/order/columns change — same dep set as columnVars above.
  const leafCounts = useMemo(() => {
    const left = table.getLeftVisibleLeafColumns().length;
    const center = table.getCenterVisibleLeafColumns().length;
    const right = table.getRightVisibleLeafColumns().length;
    return { left, center, right, total: left + center + right };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnPinning, columnOrder, columns]);

  // Index-based selection becomes meaningless after the layout shifts under it
  // or the dataset is replaced. Clear instead of trying to remap.
  useEffect(() => {
    selectionStore.clear();
  }, [selectionStore, columnOrder, columnPinning, data]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Don't fight active edit inputs / antd controls. The user can still
      // click out and back in to re-activate.
      if (target.closest("input, select, textarea, .ant-select-selector"))
        return;
      const cellEl = target.closest<HTMLElement>(".dg-cell");
      if (!cellEl) return;
      const rowAttr = cellEl.getAttribute("data-row");
      const colAttr = cellEl.getAttribute("data-col");
      if (rowAttr === null || colAttr === null) return;
      const row = Number(rowAttr);
      const col = Number(colAttr);
      if (Number.isNaN(row) || Number.isNaN(col)) return;
      selectionStore.setActive(row, col);
      // Container needs focus for arrow nav to receive keydowns.
      scrollRef.current?.focus({ preventScroll: true });
    },
    [selectionStore],
  );

  const scrollActiveIntoView = useCallback(() => {
    const s = selectionStore.getSnapshot();
    if (!s) return;
    const container = scrollRef.current;
    if (!container) return;

    // Vertical: sticky header overlays the top `rowHeight` px of the viewport,
    // so the free body view is [scrollTop + headerH, scrollTop + clientHeight].
    // The virtualizer's `scrollToIndex` doesn't account for this overlay, which
    // is why partially-occluded cells weren't being scrolled fully into view.
    const headerH = rowHeight;
    const rowStart = s.row * rowHeight;
    const rowEnd = rowStart + rowHeight;
    if (rowStart < container.scrollTop) {
      container.scrollTop = rowStart;
    } else if (rowEnd > container.scrollTop + container.clientHeight - headerH) {
      container.scrollTop = rowEnd - container.clientHeight + headerH;
    }

    // Horizontal: only center columns can scroll; pinned zones overlay both
    // sides. Free center range in doc-x is [scrollLeft + leftTotal,
    //   scrollLeft + clientWidth - rightTotal].
    const { left, center } = leafCounts;
    const isCenter = s.col >= left && s.col < left + center;
    if (!isCenter) return;
    const centerIdx = s.col - left;

    const leftCols = table.getLeftVisibleLeafColumns();
    const rightCols = table.getRightVisibleLeafColumns();
    const centerCols = table.getCenterVisibleLeafColumns();
    let leftTotal = 0;
    for (const c of leftCols) leftTotal += c.getSize();
    let rightTotal = 0;
    for (const c of rightCols) rightTotal += c.getSize();
    let colStart = 0;
    for (let i = 0; i < centerIdx; i++) colStart += centerCols[i].getSize();
    const colSize = centerCols[centerIdx].getSize();
    const colAbsStart = leftTotal + colStart;
    const colAbsEnd = colAbsStart + colSize;

    if (colAbsStart < container.scrollLeft + leftTotal) {
      container.scrollLeft = colAbsStart - leftTotal;
    } else if (
      colAbsEnd >
      container.scrollLeft + container.clientWidth - rightTotal
    ) {
      container.scrollLeft = colAbsEnd - container.clientWidth + rightTotal;
    }
  }, [selectionStore, leafCounts, rowHeight, table]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      // Bail when typing into an editor or an antd control inside a cell or
      // header dropdown — we don't want to swallow their arrow keys.
      if (
        target &&
        target.closest(
          "input, select, textarea, [contenteditable='true'], .ant-select",
        )
      ) {
        return;
      }
      const bounds = {
        rowCount: data.length,
        colCount: leafCounts.total,
      };
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          selectionStore.moveBy(-1, 0, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowDown":
          event.preventDefault();
          selectionStore.moveBy(1, 0, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowLeft":
          event.preventDefault();
          selectionStore.moveBy(0, -1, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowRight":
          event.preventDefault();
          selectionStore.moveBy(0, 1, bounds);
          scrollActiveIntoView();
          break;
        case "Escape":
          selectionStore.clear();
          break;
      }
    },
    [selectionStore, data.length, leafCounts.total, scrollActiveIntoView],
  );

  const centerColumnIds = useMemo(
    () => table.getCenterVisibleLeafColumns().map((c) => c.id),
    [columnPinning, columnOrder, columns],
  );

  const configIdentity = useMemo(() => {
    return JSON.stringify({ columnPinning, columnOrder });
  }, [columnPinning, columnOrder]);

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
      ref={scrollRef}
      className={className ? `dg-container ${className}` : "dg-container"}
      style={containerStyle}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
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
