import { useEffect, type RefObject } from "react";
import type { ColumnSizingState, Table } from "@tanstack/react-table";

import { Body } from "./Body";
import { Header } from "./header/Header";
import { useGridVirtualizers } from "../hooks/useGridVirtualizers";
import type { GridSelectionStore } from "../store/gridSelectionStore";

type Props<TData> = {
  table: Table<TData>;
  scrollRef: RefObject<HTMLDivElement | null>;
  rowCount: number;
  rowHeight: number;
  rowOverscan: number;
  columnOverscan: number;
  columnSizing: ColumnSizingState | undefined;
  centerColumnIds: string[];
  columnLayoutIdentity: string;
  selectionStore: GridSelectionStore;
  focusGrid: () => void;
  resizeEnabled: boolean;
  reorderEnabled: boolean;
};

/**
 * Owns the row + column virtualizers. Splitting this out of DataGrid means
 * scroll-driven virtualizer state updates (every horizontal arrow nav)
 * re-render only this subtree — DataGrid, the DnDContext shell, and the
 * scroll container stay put. That eliminates the dnd-kit context churn
 * that would otherwise re-render every SortableHeaderCell on each tick.
 */
export const GridContent = <TData,>({
  table,
  scrollRef,
  rowCount,
  rowHeight,
  rowOverscan,
  columnOverscan,
  columnSizing,
  centerColumnIds,
  columnLayoutIdentity,
  selectionStore,
  focusGrid,
  resizeEnabled,
  reorderEnabled,
}: Props<TData>) => {
  const { rowVirtualizer, columnVirtualizer } = useGridVirtualizers({
    scrollRef,
    table,
    rowCount,
    rowHeight,
    rowOverscan,
    columnOverscan,
  });

  const isResizing = Boolean(
    table.getState().columnSizingInfo.isResizingColumn,
  );
  const bodyHeight = rowVirtualizer.getTotalSize();
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const rows = table.getRowModel().rows;
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();

  useEffect(() => {
    if (isResizing) return;
    columnVirtualizer.measure();
  }, [columnSizing, isResizing, columnVirtualizer]);

  return (
    <>
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
        columnLayoutIdentity={columnLayoutIdentity}
        store={selectionStore}
        focusGrid={focusGrid}
      />
    </>
  );
};
