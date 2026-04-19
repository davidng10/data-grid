import { useCallback, useMemo } from "react";

import { useDataGridTransitions } from "./useDataGridTransitions";

import type { OnChangeFn } from "@tanstack/react-table";
import type {
  CellRangeSelection,
  ColumnConfigState,
  ColumnPinningState,
  DataGridProps,
  DataGridView,
  PaginationState,
  SortingState,
} from "../types";

type Updater<T> = T | ((old: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(prev)
    : updater;
}

export type UseDataGridOptions<TFilters> = {
  view: DataGridView<TFilters>;
  onViewChange: (next: DataGridView<TFilters>) => void;

  columnConfig: ColumnConfigState;
  onColumnConfigChange: (next: ColumnConfigState) => void;

  rowCount: number;

  maxVisibleColumns?: number;
  fixedVisibleColumnIds?: string[];
  fixedPositionColumnIds?: string[];
  fixedPinnedLeft?: string[];
  fixedPinnedRight?: string[];
};

export type UseDataGridResult<TRow, TFilters> = {
  gridProps: Partial<DataGridProps<TRow>>;

  setPage: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sorting: SortingState) => void;
  setFilters: (filters: TFilters) => void;

  selection: {
    rowIds: string[];
    clear: () => void;
  };
  rangeSelection: {
    current: CellRangeSelection | null;
    clear: () => void;
  };
};

export function useDataGrid<TRow, TFilters>(
  options: UseDataGridOptions<TFilters>,
): UseDataGridResult<TRow, TFilters> {
  const {
    view,
    onViewChange,
    columnConfig,
    onColumnConfigChange,
    rowCount,
    maxVisibleColumns = 40,
    fixedVisibleColumnIds,
    fixedPositionColumnIds,
    fixedPinnedLeft,
    fixedPinnedRight,
  } = options;

  // Transient state owned end-to-end by the grid (rowSelection, cellRange,
  // activeEditor) + the transition rules (what clears on what) live in this
  // reducer. The README transition table maps 1:1 to the action cases.
  const { state: transitions, actions: tx } = useDataGridTransitions();
  const { rowSelection, cellRangeSelection, activeEditor } = transitions;

  // --- Semantic setters: view mutation + reducer dispatch ---

  const setPage = useCallback(
    (pageIndex: number) => {
      onViewChange({ ...view, pageIndex });
      tx.pageChanged();
    },
    [view, onViewChange, tx],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      onViewChange({ ...view, pageSize, pageIndex: 0 });
      tx.pageChanged();
    },
    [view, onViewChange, tx],
  );

  const setSort = useCallback(
    (sorting: SortingState) => {
      onViewChange({ ...view, sorting, pageIndex: 0 });
      tx.sortChanged();
    },
    [view, onViewChange, tx],
  );

  const setFilters = useCallback(
    (filters: TFilters) => {
      onViewChange({ ...view, filters, pageIndex: 0 });
      tx.filtersChanged();
    },
    [view, onViewChange, tx],
  );

  // --- TanStack OnChangeFn adapters: resolve updater, then delegate ---

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, view.sorting);
      setSort(next);
    },
    [view.sorting, setSort],
  );

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const prev: PaginationState = {
        pageIndex: view.pageIndex,
        pageSize: view.pageSize,
      };
      const next = resolveUpdater(updater, prev);
      if (next.pageSize !== prev.pageSize) {
        setPageSize(next.pageSize);
        return;
      }
      if (next.pageIndex !== prev.pageIndex) {
        setPage(next.pageIndex);
      }
    },
    [view.pageIndex, view.pageSize, setPage, setPageSize],
  );

  const onColumnVisibilityChange: OnChangeFn<Record<string, boolean>> =
    useCallback(
      (updater) => {
        const next = resolveUpdater(updater, columnConfig.columnVisibility);
        const trueCount = Object.values(next).filter(Boolean).length;
        if (trueCount > maxVisibleColumns) {
          console.warn(`Maximum ${maxVisibleColumns} columns visible`);
          return;
        }
        const enforced = { ...next };
        for (const id of fixedVisibleColumnIds ?? []) enforced[id] = true;
        onColumnConfigChange({
          ...columnConfig,
          columnVisibility: enforced,
        });
      },
      [
        columnConfig,
        maxVisibleColumns,
        fixedVisibleColumnIds,
        onColumnConfigChange,
      ],
    );

  const onColumnOrderChange: OnChangeFn<string[]> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, columnConfig.columnOrder);
      const fixed = fixedPositionColumnIds ?? [];
      for (const id of fixed) {
        if (columnConfig.columnOrder.indexOf(id) !== next.indexOf(id)) {
          console.warn(
            `Column "${id}" is fixed-position and cannot be reordered`,
          );
          return;
        }
      }
      onColumnConfigChange({ ...columnConfig, columnOrder: next });
    },
    [columnConfig, fixedPositionColumnIds, onColumnConfigChange],
  );

  const onColumnSizingChange: OnChangeFn<Record<string, number>> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, columnConfig.columnSizing);
      onColumnConfigChange({ ...columnConfig, columnSizing: next });
    },
    [columnConfig, onColumnConfigChange],
  );

  const onColumnPinningChange: OnChangeFn<ColumnPinningState> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, columnConfig.columnPinning);
      const leftFixed = fixedPinnedLeft ?? [];
      const rightFixed = fixedPinnedRight ?? [];

      // Drop any fixed-pinned ids from their non-canonical side
      let left = next.left.filter((id) => !rightFixed.includes(id));
      let right = next.right.filter((id) => !leftFixed.includes(id));

      // Force fixed-pinned ids into canonical position if absent
      for (const id of leftFixed) {
        if (!left.includes(id)) left = [id, ...left];
      }
      for (const id of rightFixed) {
        if (!right.includes(id)) right = [...right, id];
      }

      onColumnConfigChange({
        ...columnConfig,
        columnPinning: { left, right },
      });
    },
    [columnConfig, fixedPinnedLeft, fixedPinnedRight, onColumnConfigChange],
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: view.pageIndex, pageSize: view.pageSize }),
    [view.pageIndex, view.pageSize],
  );

  const gridProps = useMemo<Partial<DataGridProps<TRow>>>(
    () => ({
      rowCount,

      sorting: view.sorting,
      onSortingChange,

      pagination,
      onPaginationChange,

      rowSelection,
      onRowSelectionChange: tx.setRowSelection,

      cellRangeSelection,
      onCellRangeSelectionChange: tx.setCellRangeSelection,

      columnVisibility: columnConfig.columnVisibility,
      onColumnVisibilityChange,

      columnOrder: columnConfig.columnOrder,
      onColumnOrderChange,

      columnSizing: columnConfig.columnSizing,
      onColumnSizingChange,

      columnPinning: columnConfig.columnPinning,
      onColumnPinningChange,

      activeEditor,
      onActiveEditorChange: tx.setActiveEditor,
    }),
    [
      rowCount,
      view.sorting,
      pagination,
      rowSelection,
      cellRangeSelection,
      activeEditor,
      columnConfig.columnVisibility,
      columnConfig.columnOrder,
      columnConfig.columnSizing,
      columnConfig.columnPinning,
      // tx setters are stable (useCallback over stable dispatch) — depend on
      // the bundle identity rather than each setter individually.
      tx,
      onSortingChange,
      onPaginationChange,
      onColumnVisibilityChange,
      onColumnOrderChange,
      onColumnSizingChange,
      onColumnPinningChange,
    ],
  );

  const selection = useMemo(
    () => ({
      rowIds: Object.entries(rowSelection)
        .filter(([, v]) => v)
        .map(([k]) => k),
      clear: () => tx.setRowSelection({}),
    }),
    [rowSelection, tx],
  );

  const rangeSelectionResult = useMemo(
    () => ({
      current: cellRangeSelection,
      clear: () => tx.setCellRangeSelection(null),
    }),
    [cellRangeSelection, tx],
  );

  return {
    gridProps,
    setPage,
    setPageSize,
    setSort,
    setFilters,
    selection,
    rangeSelection: rangeSelectionResult,
  };
}
