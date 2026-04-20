import { useCallback, useEffect, useMemo } from "react";

import { useDataGridTransitions } from "./useDataGridTransitions";

import type { OnChangeFn } from "@tanstack/react-table";
import type {
  ColumnConfigState,
  ColumnPinningState,
  DataGridColumnDef,
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

type FixedIdSets = {
  fixedVisible: Set<string>;
  fixedPosition: Set<string>;
  fixedPinnedLeft: string[];
  fixedPinnedRight: string[];
};

function deriveFixedIds<TRow>(
  columns: DataGridColumnDef<TRow>[],
): FixedIdSets {
  const fixedVisible = new Set<string>();
  const fixedPosition = new Set<string>();
  const fixedPinnedLeft: string[] = [];
  const fixedPinnedRight: string[] = [];
  for (const c of columns) {
    if (c.fixedVisible) fixedVisible.add(c.id);
    if (c.fixedPosition) fixedPosition.add(c.id);
    if (c.fixedPin && c.pin === "left") fixedPinnedLeft.push(c.id);
    if (c.fixedPin && c.pin === "right") fixedPinnedRight.push(c.id);
  }
  return { fixedVisible, fixedPosition, fixedPinnedLeft, fixedPinnedRight };
}

function sameArr(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) return false;
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function configEquals(a: ColumnConfigState, b: ColumnConfigState): boolean {
  return (
    sameArr(a.columnOrder, b.columnOrder) &&
    sameRecord(a.columnVisibility, b.columnVisibility) &&
    sameRecord(a.columnSizing, b.columnSizing) &&
    sameArr(a.columnPinning.left, b.columnPinning.left) &&
    sameArr(a.columnPinning.right, b.columnPinning.right)
  );
}

// Reconcile an arbitrary (possibly-empty, possibly-stale) ColumnConfigState
// against the live `columns` defs. Produces a config that satisfies every
// fixed-* invariant declared on the defs. Idempotent: reconcile(reconcile(x))
// equals reconcile(x), so the mount-time write-back settles in one pass.
function reconcileColumnConfig<TRow>(
  columns: DataGridColumnDef<TRow>[],
  config: ColumnConfigState,
  maxVisibleColumns: number,
): ColumnConfigState {
  const defIds = columns.map((c) => c.id);
  const defIdSet = new Set(defIds);
  const isFresh = config.columnOrder.length === 0;

  const { fixedVisible, fixedPosition, fixedPinnedLeft, fixedPinnedRight } =
    deriveFixedIds(columns);
  const leftFixedSet = new Set(fixedPinnedLeft);
  const rightFixedSet = new Set(fixedPinnedRight);

  let baseOrder: string[];
  if (isFresh) {
    baseOrder = [...defIds];
  } else {
    const kept = config.columnOrder.filter((id) => defIdSet.has(id));
    const seen = new Set(kept);
    const missing = defIds.filter((id) => !seen.has(id));
    baseOrder = [...kept, ...missing];
  }
  const nonFixed = baseOrder.filter((id) => !fixedPosition.has(id));
  const finalOrder: string[] = [];
  let nfIdx = 0;
  for (const id of defIds) {
    if (fixedPosition.has(id)) {
      finalOrder.push(id);
    } else if (nfIdx < nonFixed.length) {
      finalOrder.push(nonFixed[nfIdx++]);
    }
  }
  while (nfIdx < nonFixed.length) finalOrder.push(nonFixed[nfIdx++]);

  const visIn = isFresh ? {} : config.columnVisibility;
  const visibility: Record<string, boolean> = {};
  for (const id of defIds) {
    if (fixedVisible.has(id)) {
      visibility[id] = true;
    } else if (isFresh) {
      visibility[id] = true;
    } else {
      visibility[id] = id in visIn ? Boolean(visIn[id]) : true;
    }
  }
  const trueIds = defIds.filter((id) => visibility[id]);
  if (trueIds.length > maxVisibleColumns) {
    let over = trueIds.length - maxVisibleColumns;
    for (let i = defIds.length - 1; i >= 0 && over > 0; i--) {
      const id = defIds[i];
      if (visibility[id] && !fixedVisible.has(id)) {
        visibility[id] = false;
        over--;
      }
    }
  }

  const sizingIn = isFresh ? {} : config.columnSizing;
  const sizing: Record<string, number> = {};
  for (const [id, v] of Object.entries(sizingIn)) {
    if (defIdSet.has(id) && typeof v === "number" && !Number.isNaN(v)) {
      sizing[id] = v;
    }
  }

  let left: string[];
  let right: string[];
  if (isFresh) {
    left = columns.filter((c) => c.pin === "left").map((c) => c.id);
    right = columns.filter((c) => c.pin === "right").map((c) => c.id);
  } else {
    const storedLeft = config.columnPinning.left.filter(
      (id) =>
        defIdSet.has(id) && !leftFixedSet.has(id) && !rightFixedSet.has(id),
    );
    const storedRight = config.columnPinning.right.filter(
      (id) =>
        defIdSet.has(id) && !leftFixedSet.has(id) && !rightFixedSet.has(id),
    );
    left = [...fixedPinnedLeft, ...storedLeft];
    right = [...storedRight, ...fixedPinnedRight];
  }

  return {
    columnVisibility: visibility,
    columnOrder: finalOrder,
    columnSizing: sizing,
    columnPinning: { left, right },
    schemaVersion: 1,
  };
}

export type UseDataGridOptions<TRow, TFilters> = {
  view: DataGridView<TFilters>;
  onViewChange: (next: DataGridView<TFilters>) => void;

  columns: DataGridColumnDef<TRow>[];
  columnConfig: ColumnConfigState;
  onColumnConfigChange: (next: ColumnConfigState) => void;

  rowCount: number;

  maxVisibleColumns?: number;
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
};

export function useDataGrid<TRow, TFilters>(
  options: UseDataGridOptions<TRow, TFilters>,
): UseDataGridResult<TRow, TFilters> {
  const {
    view,
    onViewChange,
    columns,
    columnConfig,
    onColumnConfigChange,
    rowCount,
    maxVisibleColumns = 40,
  } = options;

  const fixedIds = useMemo(() => deriveFixedIds(columns), [columns]);

  // Single source of truth for the fixed-* invariants. Runs on every change
  // to `columns` / `columnConfig`; the write-back effect below nudges the
  // parent's stored state to match when it drifts.
  const effectiveColumnConfig = useMemo(
    () => reconcileColumnConfig(columns, columnConfig, maxVisibleColumns),
    [columns, columnConfig, maxVisibleColumns],
  );

  useEffect(() => {
    if (!configEquals(effectiveColumnConfig, columnConfig)) {
      onColumnConfigChange(effectiveColumnConfig);
    }
  }, [effectiveColumnConfig, columnConfig, onColumnConfigChange]);

  const { state: transitions, actions: tx } = useDataGridTransitions();
  const { rowSelection, activeEditor } = transitions;

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
        const next = resolveUpdater(
          updater,
          effectiveColumnConfig.columnVisibility,
        );
        const trueCount = Object.values(next).filter(Boolean).length;
        if (trueCount > maxVisibleColumns) {
          console.warn(`Maximum ${maxVisibleColumns} columns visible`);
          return;
        }
        const enforced = { ...next };
        for (const id of fixedIds.fixedVisible) enforced[id] = true;
        onColumnConfigChange({
          ...effectiveColumnConfig,
          columnVisibility: enforced,
        });
      },
      [
        effectiveColumnConfig,
        maxVisibleColumns,
        fixedIds.fixedVisible,
        onColumnConfigChange,
      ],
    );

  const onColumnOrderChange: OnChangeFn<string[]> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, effectiveColumnConfig.columnOrder);
      for (const id of fixedIds.fixedPosition) {
        if (
          effectiveColumnConfig.columnOrder.indexOf(id) !== next.indexOf(id)
        ) {
          console.warn(
            `Column "${id}" is fixed-position and cannot be reordered`,
          );
          return;
        }
      }
      onColumnConfigChange({ ...effectiveColumnConfig, columnOrder: next });
    },
    [effectiveColumnConfig, fixedIds.fixedPosition, onColumnConfigChange],
  );

  const onColumnSizingChange: OnChangeFn<Record<string, number>> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, effectiveColumnConfig.columnSizing);
      onColumnConfigChange({ ...effectiveColumnConfig, columnSizing: next });
    },
    [effectiveColumnConfig, onColumnConfigChange],
  );

  const onColumnPinningChange: OnChangeFn<ColumnPinningState> = useCallback(
    (updater) => {
      const next = resolveUpdater(updater, effectiveColumnConfig.columnPinning);
      const leftFixed = fixedIds.fixedPinnedLeft;
      const rightFixed = fixedIds.fixedPinnedRight;

      let left = next.left.filter((id) => !rightFixed.includes(id));
      let right = next.right.filter((id) => !leftFixed.includes(id));

      for (const id of leftFixed) {
        if (!left.includes(id)) left = [id, ...left];
      }
      for (const id of rightFixed) {
        if (!right.includes(id)) right = [...right, id];
      }

      onColumnConfigChange({
        ...effectiveColumnConfig,
        columnPinning: { left, right },
      });
    },
    [
      effectiveColumnConfig,
      fixedIds.fixedPinnedLeft,
      fixedIds.fixedPinnedRight,
      onColumnConfigChange,
    ],
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

      columnVisibility: effectiveColumnConfig.columnVisibility,
      onColumnVisibilityChange,

      columnOrder: effectiveColumnConfig.columnOrder,
      onColumnOrderChange,

      columnSizing: effectiveColumnConfig.columnSizing,
      onColumnSizingChange,

      columnPinning: effectiveColumnConfig.columnPinning,
      onColumnPinningChange,

      activeEditor,
      onActiveEditorChange: tx.setActiveEditor,
    }),
    [
      rowCount,
      view.sorting,
      pagination,
      rowSelection,
      activeEditor,
      effectiveColumnConfig,
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

  return {
    gridProps,
    setPage,
    setPageSize,
    setSort,
    setFilters,
    selection,
  };
}
