import { useCallback, useMemo, useState } from "react";
import type { OnChangeFn } from "@tanstack/react-table";
import type {
  ActiveEditorState,
  CellRangeSelection,
  ColumnConfigState,
  ColumnPinningState,
  DataGridProps,
  DataGridView,
  PaginationState,
  SortingState,
} from "../components/DataGrid/DataGrid.types";

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

  allowSorting?: boolean;
  allowPinning?: boolean;
  allowReorder?: boolean;
  allowResize?: boolean;
  allowColumnVisibility?: boolean;
  allowRowSelection?: boolean;
  allowRangeSelection?: boolean;
  allowInlineEdit?: boolean;

  onWarn?: (message: string) => void;
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
    allowSorting = true,
    allowPinning = true,
    allowReorder = true,
    allowResize = true,
    allowColumnVisibility = true,
    allowRowSelection = true,
    allowRangeSelection = true,
    allowInlineEdit = false,
    onWarn,
  } = options;

  const warn = useCallback(
    (message: string) => {
      if (onWarn) onWarn(message);
      else console.warn(message);
    },
    [onWarn],
  );

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [cellRangeSelection, setCellRangeSelection] =
    useState<CellRangeSelection | null>(null);
  const [activeEditor, setActiveEditor] = useState<ActiveEditorState>(null);

  // --- Semantic setters: transition rules encoded here ---

  const setPage = useCallback(
    (pageIndex: number) => {
      onViewChange({ ...view, pageIndex });
      setCellRangeSelection(null);
    },
    [view, onViewChange],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      onViewChange({ ...view, pageSize, pageIndex: 0 });
      setCellRangeSelection(null);
    },
    [view, onViewChange],
  );

  const setSort = useCallback(
    (sorting: SortingState) => {
      onViewChange({ ...view, sorting, pageIndex: 0 });
      setRowSelection({});
      setCellRangeSelection(null);
    },
    [view, onViewChange],
  );

  const setFilters = useCallback(
    (filters: TFilters) => {
      onViewChange({ ...view, filters, pageIndex: 0 });
      setRowSelection({});
      setCellRangeSelection(null);
    },
    [view, onViewChange],
  );

  // --- Grid-facing change handlers route through the semantic setters ---

  const onSortingChangeForGrid: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, view.sorting);
      setSort(next);
    },
    [view.sorting, setSort],
  );

  const onPaginationChangeForGrid: OnChangeFn<PaginationState> = useCallback(
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

  const onRowSelectionChangeForGrid: OnChangeFn<Record<string, boolean>> =
    useCallback((updater) => {
      setRowSelection((prev) => resolveUpdater(updater, prev));
    }, []);

  const onCellRangeSelectionChangeForGrid: OnChangeFn<CellRangeSelection | null> =
    useCallback((updater) => {
      setCellRangeSelection((prev) => resolveUpdater(updater, prev));
    }, []);

  const onActiveEditorChangeForGrid: OnChangeFn<ActiveEditorState> = useCallback(
    (updater) => {
      setActiveEditor((prev) => resolveUpdater(updater, prev));
    },
    [],
  );

  const onColumnVisibilityChangeForGrid: OnChangeFn<Record<string, boolean>> =
    useCallback(
      (updater) => {
        const next = resolveUpdater(updater, columnConfig.columnVisibility);
        const trueCount = Object.values(next).filter(Boolean).length;
        if (trueCount > maxVisibleColumns) {
          warn(`Maximum ${maxVisibleColumns} columns visible`);
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
        warn,
      ],
    );

  const onColumnOrderChangeForGrid: OnChangeFn<string[]> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, columnConfig.columnOrder);
      const fixed = fixedPositionColumnIds ?? [];
      for (const id of fixed) {
        if (columnConfig.columnOrder.indexOf(id) !== next.indexOf(id)) {
          warn(`Column "${id}" is fixed-position and cannot be reordered`);
          return;
        }
      }
      onColumnConfigChange({ ...columnConfig, columnOrder: next });
    },
    [columnConfig, fixedPositionColumnIds, onColumnConfigChange, warn],
  );

  const onColumnSizingChangeForGrid: OnChangeFn<Record<string, number>> =
    useCallback(
      (updater) => {
        const next = resolveUpdater(updater, columnConfig.columnSizing);
        onColumnConfigChange({ ...columnConfig, columnSizing: next });
      },
      [columnConfig, onColumnConfigChange],
    );

  const onColumnPinningChangeForGrid: OnChangeFn<ColumnPinningState> =
    useCallback(
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

  // --- gridProps assembly ---

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: view.pageIndex, pageSize: view.pageSize }),
    [view.pageIndex, view.pageSize],
  );

  const gridProps = useMemo<Partial<DataGridProps<TRow>>>(
    () => ({
      rowCount,

      sorting: view.sorting,
      onSortingChange: onSortingChangeForGrid,

      pagination,
      onPaginationChange: onPaginationChangeForGrid,

      rowSelection,
      onRowSelectionChange: onRowSelectionChangeForGrid,

      cellRangeSelection,
      onCellRangeSelectionChange: onCellRangeSelectionChangeForGrid,

      columnVisibility: columnConfig.columnVisibility,
      onColumnVisibilityChange: onColumnVisibilityChangeForGrid,

      columnOrder: columnConfig.columnOrder,
      onColumnOrderChange: onColumnOrderChangeForGrid,

      columnSizing: columnConfig.columnSizing,
      onColumnSizingChange: onColumnSizingChangeForGrid,

      columnPinning: columnConfig.columnPinning,
      onColumnPinningChange: onColumnPinningChangeForGrid,

      activeEditor,
      onActiveEditorChange: onActiveEditorChangeForGrid,

      allowSorting,
      allowPinning,
      allowReorder,
      allowResize,
      allowColumnVisibility,
      allowRowSelection,
      allowRangeSelection,
      allowInlineEdit,
    }),
    [
      rowCount,
      view.sorting,
      pagination,
      rowSelection,
      cellRangeSelection,
      columnConfig.columnVisibility,
      columnConfig.columnOrder,
      columnConfig.columnSizing,
      columnConfig.columnPinning,
      activeEditor,
      allowSorting,
      allowPinning,
      allowReorder,
      allowResize,
      allowColumnVisibility,
      allowRowSelection,
      allowRangeSelection,
      allowInlineEdit,
      onSortingChangeForGrid,
      onPaginationChangeForGrid,
      onRowSelectionChangeForGrid,
      onCellRangeSelectionChangeForGrid,
      onColumnVisibilityChangeForGrid,
      onColumnOrderChangeForGrid,
      onColumnSizingChangeForGrid,
      onColumnPinningChangeForGrid,
      onActiveEditorChangeForGrid,
    ],
  );

  const selection = useMemo(
    () => ({
      rowIds: Object.entries(rowSelection)
        .filter(([, v]) => v)
        .map(([k]) => k),
      clear: () => setRowSelection({}),
    }),
    [rowSelection],
  );

  const rangeSelectionResult = useMemo(
    () => ({
      current: cellRangeSelection,
      clear: () => setCellRangeSelection(null),
    }),
    [cellRangeSelection],
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
