import {
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { Table } from "@tanstack/react-table";

import type { GridSelectionStore } from "./gridSelectionStore";
import { useGridSelection } from "./useGridSelection";

type LeafCounts = {
  left: number;
  center: number;
  right: number;
  total: number;
};

type Args<TData> = {
  scrollRef: RefObject<HTMLDivElement | null>;
  table: Table<TData>;
  rowCount: number;
  rowHeight: number;
  leafCounts: LeafCounts;
  configIdentity: string;
};

type Return = {
  store: GridSelectionStore;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export const useCellNavigation = <TData,>({
  scrollRef,
  table,
  rowCount,
  rowHeight,
  leafCounts,
  configIdentity,
}: Args<TData>): Return => {
  const store = useGridSelection();

  // Column layout changes (reorder/pinning) invalidate the (row, col) index
  // mapping, so clear instead of trying to remap. configIdentity is a
  // content-based hash so unstable parent prop references don't trip this.
  // Tradeoff: a parent-driven sort/replace with same length leaves a stale
  // highlight — that needs row-id tracking to fix properly.
  useEffect(() => {
    store.clear();
  }, [store, configIdentity]);

  // Bounds guard: when row or column counts shrink past the active position,
  // clamp (or clear if either dimension hit zero). Depends on counts, not on
  // `data` or `columns` arrays, so cell commits don't trip it.
  useEffect(() => {
    const s = store.getSnapshot();
    if (!s) return;
    if (rowCount === 0 || leafCounts.total === 0) {
      store.clear();
      return;
    }
    if (s.row >= rowCount || s.col >= leafCounts.total) {
      store.setActive(
        Math.min(s.row, rowCount - 1),
        Math.min(s.col, leafCounts.total - 1),
      );
    }
  }, [store, rowCount, leafCounts.total]);

  const onPointerDown = useCallback(
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
      store.setActive(row, col);
      // Container needs focus for arrow nav to receive keydowns.
      scrollRef.current?.focus({ preventScroll: true });
    },
    [store, scrollRef],
  );

  const scrollActiveIntoView = useCallback(() => {
    const s = store.getSnapshot();
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
    } else if (
      rowEnd >
      container.scrollTop + container.clientHeight - headerH
    ) {
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
  }, [store, leafCounts, rowHeight, table, scrollRef]);

  const onKeyDown = useCallback(
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
        rowCount,
        colCount: leafCounts.total,
      };
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          store.moveBy(-1, 0, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowDown":
          event.preventDefault();
          store.moveBy(1, 0, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowLeft":
          event.preventDefault();
          store.moveBy(0, -1, bounds);
          scrollActiveIntoView();
          break;
        case "ArrowRight":
          event.preventDefault();
          store.moveBy(0, 1, bounds);
          scrollActiveIntoView();
          break;
        case "Escape":
          store.clear();
          break;
      }
    },
    [store, rowCount, leafCounts.total, scrollActiveIntoView],
  );

  return { store, onPointerDown, onKeyDown };
};
