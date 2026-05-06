import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { Table } from "@tanstack/react-table";

import type { GridSelectionStore } from "./gridSelectionStore";
import type { DataGridColumnDef } from "./types";
import { useGridSelection } from "./useGridSelection";

type Args<TData> = {
  scrollRef: RefObject<HTMLDivElement | null>;
  table: Table<TData>;
  rowCount: number;
  rowHeight: number;
  visibleColumnIds: readonly string[];
};

type Return = {
  store: GridSelectionStore;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClick: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export const useCellNavigation = <TData,>({
  scrollRef,
  table,
  rowCount,
  rowHeight,
  visibleColumnIds,
}: Args<TData>): Return => {
  const store = useGridSelection();
  const rowIndexCacheRef = useRef<{
    rows: readonly { id: string }[] | null;
    map: Map<string, number>;
  }>({ rows: null, map: new Map() });

  const getVisibleLeafColumns = useCallback(
    () => [
      ...table.getLeftVisibleLeafColumns(),
      ...table.getCenterVisibleLeafColumns(),
      ...table.getRightVisibleLeafColumns(),
    ],
    [table],
  );

  const canEditColumn = useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      const columnDef = column?.columnDef as
        | DataGridColumnDef<TData, unknown>
        | undefined;
      return Boolean(columnDef?.editable && columnDef.editCell);
    },
    [table],
  );

  const enterEditMode = useCallback(
    (rowId: string, columnId: string) => {
      if (!canEditColumn(columnId)) return false;
      store.setEditing(rowId, columnId);
      return true;
    },
    [canEditColumn, store],
  );

  const getRowIndexById = useCallback(
    (rowId: string) => {
      const rows = table.getRowModel().rows;
      const cache = rowIndexCacheRef.current;
      if (cache.rows !== rows) {
        cache.rows = rows;
        cache.map = new Map(rows.map((row, index) => [row.id, index]));
      }
      return cache.map.get(rowId) ?? -1;
    },
    [table],
  );

  // Identity guard: keep reorder/pinning stable, but clear when the active
  // logical cell no longer exists in the visible row/column model.
  useEffect(() => {
    const active = store.getSnapshot();
    if (!active) return;
    if (rowCount === 0 || visibleColumnIds.length === 0) {
      store.clear();
      return;
    }
    if (
      !visibleColumnIds.includes(active.columnId) ||
      getRowIndexById(active.rowId) < 0
    ) {
      store.clear();
    }
  }, [store, rowCount, visibleColumnIds, getRowIndexById]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const active = store.getSnapshot();
      if (active?.mode === "edit") return;

      const cellEl = target.closest<HTMLElement>(".dg-cell");
      if (!cellEl) return;
      const rowId = cellEl.getAttribute("data-row-id");
      const columnId = cellEl.getAttribute("data-column-id");
      if (rowId === null || columnId === null) return;

      store.setActive(rowId, columnId);
      // Container needs focus for arrow nav to receive keydowns.
      scrollRef.current?.focus({ preventScroll: true });
    },
    [store, scrollRef],
  );

  const onDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const active = store.getSnapshot();
      if (active?.mode === "edit") return;

      const cellEl = target.closest<HTMLElement>(".dg-cell");
      if (!cellEl) return;
      const rowId = cellEl.getAttribute("data-row-id");
      const columnId = cellEl.getAttribute("data-column-id");
      if (rowId === null || columnId === null) return;
      if (enterEditMode(rowId, columnId)) event.preventDefault();
    },
    [store, enterEditMode],
  );

  const scrollCellIntoView = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const container = scrollRef.current;
      if (!container) return;

      // Vertical: sticky header overlays the top `rowHeight` px of the viewport,
      // so the free body view is [scrollTop + headerH, scrollTop + clientHeight].
      // The virtualizer's `scrollToIndex` doesn't account for this overlay, which
      // is why partially-occluded cells weren't being scrolled fully into view.
      const headerH = rowHeight;
      const rowStart = rowIndex * rowHeight;
      const rowEnd = rowStart + rowHeight;
      if (rowStart < container.scrollTop) {
        container.scrollTop = rowStart;
      } else if (
        rowEnd >
        container.scrollTop + container.clientHeight - headerH
      ) {
        container.scrollTop = rowEnd - container.clientHeight + headerH;
      }

      // Horizontal: only center columns can scroll; pinned zones overlay both
      // sides. Free center range in doc-x is [scrollLeft + leftTotal,
      //   scrollLeft + clientWidth - rightTotal].
      const leftCols = table.getLeftVisibleLeafColumns();
      const rightCols = table.getRightVisibleLeafColumns();
      const centerCols = table.getCenterVisibleLeafColumns();
      const isCenter =
        columnIndex >= leftCols.length &&
        columnIndex < leftCols.length + centerCols.length;
      if (!isCenter) return;
      const centerIdx = columnIndex - leftCols.length;
      const centerColumn = centerCols[centerIdx];
      if (!centerColumn) return;

      let leftTotal = 0;
      for (const c of leftCols) leftTotal += c.getSize();
      let rightTotal = 0;
      for (const c of rightCols) rightTotal += c.getSize();
      let colStart = 0;
      for (let i = 0; i < centerIdx; i++) colStart += centerCols[i].getSize();
      const colSize = centerColumn.getSize();
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
    },
    [rowHeight, table, scrollRef],
  );

  const moveActiveBy = useCallback(
    (dr: number, dc: number) => {
      const rows = table.getRowModel().rows;
      const columns = getVisibleLeafColumns();
      if (rows.length === 0 || columns.length === 0) return;

      const active = store.getSnapshot();
      let rowIndex = 0;
      let columnIndex = 0;
      if (active) {
        const activeRowIndex = getRowIndexById(active.rowId);
        const activeColumnIndex = columns.findIndex(
          (column) => column.id === active.columnId,
        );
        if (activeRowIndex >= 0 && activeColumnIndex >= 0) {
          rowIndex = Math.max(
            0,
            Math.min(rows.length - 1, activeRowIndex + dr),
          );
          columnIndex = Math.max(
            0,
            Math.min(columns.length - 1, activeColumnIndex + dc),
          );
        }
      }

      const row = rows[rowIndex];
      const column = columns[columnIndex];
      if (!row || !column) return;
      store.setActive(row.id, column.id);
      scrollCellIntoView(rowIndex, columnIndex);
    },
    [
      table,
      getVisibleLeafColumns,
      store,
      getRowIndexById,
      scrollCellIntoView,
    ],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          moveActiveBy(-1, 0);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveActiveBy(1, 0);
          break;
        case "ArrowLeft":
          event.preventDefault();
          moveActiveBy(0, -1);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveActiveBy(0, 1);
          break;
        case "Enter":
        case "F2": {
          const active = store.getSnapshot();
          if (!active) break;
          if (enterEditMode(active.rowId, active.columnId)) {
            event.preventDefault();
          }
          break;
        }
        case "Escape":
          store.clear();
          break;
      }
    },
    [store, moveActiveBy, enterEditMode],
  );

  return { store, onPointerDown, onDoubleClick, onKeyDown };
};
