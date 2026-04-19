import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";

import type { ColumnDef, OnChangeFn } from "@tanstack/react-table";
import type { ForwardedRef, ReactElement } from "react";
import type {
  DataGridColumnDef,
  DataGridHandle,
  DataGridProps,
} from "./DataGrid.types";
import type {
  DataGridContextValue,
  DataGridFeatureFlags,
} from "./DataGridContext";

import { DataGridContext } from "./DataGridContext";
import { VirtualRow } from "./body/VirtualRow";
import { CheckboxCell } from "./cells/CheckboxCell";
import { HeaderCheckbox } from "./header/HeaderCheckbox";
import { HeaderRow } from "./header/HeaderRow";
import { HeaderSelectionContext } from "./selection/HeaderSelectionContext";
import { SELECT_COLUMN_ID } from "./selection/constants";
import { useCellRangeSelection } from "./selection/useCellRangeSelection";
import { useRowSelection } from "./selection/useRowSelection";
import styles from "./DataGrid.module.css";

// Vite substitutes `process.env.NODE_ENV` in client code at build time
// (matching webpack's convention). Declare the shape locally so the check
// type-checks without pulling in @types/node.
declare const process: { readonly env: { readonly NODE_ENV: string } };

// TanStack's ColumnPinningState has optional `left?: string[]` / `right?: string[]`;
// ours has required arrays. They're otherwise identical — cast at the boundary.
type TSTColumnPinning = { left?: string[]; right?: string[] };

const EMPTY_EXTRAS: Record<string, unknown> = Object.freeze({});

function toTanStackColumns<TRow>(
  columns: DataGridColumnDef<TRow>[],
): ColumnDef<TRow>[] {
  return columns.map((col) => {
    const headerDef = col.header;
    return {
      id: col.id,
      header:
        typeof headerDef === "string" ? headerDef : (ctx) => headerDef(ctx),
      accessorFn: (row: TRow) => col.accessor(row),
      size: col.width ?? 160,
      minSize: col.minWidth ?? 60,
      maxSize: col.maxWidth ?? 800,
      enableSorting:
        col.meta?.sortable === undefined ? true : col.meta.sortable,
      meta: {
        dataGridColumn: col,
      },
    };
  });
}

// The injected row-selection column. Defined at module scope (and never
// re-built) so it stays referentially stable across renders — its inclusion
// in the columns array therefore doesn't churn the TanStack Table instance.
const SELECT_COLUMN: DataGridColumnDef<unknown> = {
  id: SELECT_COLUMN_ID,
  header: () => <HeaderCheckbox />,
  accessor: () => null,
  cell: CheckboxCell,
  width: 44,
  minWidth: 44,
  maxWidth: 44,
  pin: "left",
  fixedPin: true,
  fixedPosition: true,
  fixedVisible: true,
  meta: { sortable: false },
};

function DataGridInner<TRow>(
  props: DataGridProps<TRow>,
  ref: ForwardedRef<DataGridHandle>,
): ReactElement {
  const {
    data,
    rowCount,
    getRowId,
    columns: dgColumns,
    isLoading,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    rowSelection,
    onRowSelectionChange,
    cellRangeSelection,
    onCellRangeSelectionChange,
    columnVisibility,
    onColumnVisibilityChange,
    columnOrder,
    onColumnOrderChange,
    columnSizing,
    onColumnSizingChange,
    columnPinning,
    onColumnPinningChange,
    allowSorting = true,
    allowPinning = true,
    allowReorder = true,
    allowResize = true,
    allowColumnVisibility = true,
    allowRowSelection = true,
    allowRangeSelection = true,
    allowInlineEdit = false,
    rowHeight = 40,
    headerHeight = 40,
    overscan = 10,
    cellExtras,
    emptyState,
    className,
    onRangeContextMenu,
    onRangeCopy,
  } = props;

  // Inject the synthetic __select__ column when row selection is enabled. The
  // column object itself is module-scoped & stable; the array reference still
  // changes whenever `dgColumns` does, so memo deps stay honest.
  const augmentedDgColumns = useMemo<DataGridColumnDef<TRow>[]>(() => {
    if (!allowRowSelection) return dgColumns;
    return [SELECT_COLUMN as unknown as DataGridColumnDef<TRow>, ...dgColumns];
  }, [allowRowSelection, dgColumns]);

  const tanstackColumns = useMemo(
    () => toTanStackColumns(augmentedDgColumns),
    [augmentedDgColumns],
  );

  const pageCount = useMemo(() => {
    if (!pagination || pagination.pageSize <= 0) return -1;
    return Math.max(1, Math.ceil(rowCount / pagination.pageSize));
  }, [pagination, rowCount]);

  // When `allowRowSelection` is on, force the __select__ column into the left
  // pinned set so the table treats it as fixed-left even if the consumer
  // didn't pre-seed `columnPinning.left`. We splice rather than override so
  // user-provided pin order is preserved.
  const effectiveColumnPinning = useMemo<TSTColumnPinning | undefined>(() => {
    if (!allowRowSelection)
      return columnPinning as TSTColumnPinning | undefined;
    const left = columnPinning?.left ?? [];
    const right = columnPinning?.right ?? [];
    if (left.includes(SELECT_COLUMN_ID)) {
      return { left, right };
    }
    return { left: [SELECT_COLUMN_ID, ...left], right };
  }, [allowRowSelection, columnPinning]);

  const table = useReactTable<TRow>({
    data,
    columns: tanstackColumns,
    getRowId,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
      columnOrder,
      columnSizing,
      columnPinning: effectiveColumnPinning,
    },
    onSortingChange,
    onPaginationChange,
    onRowSelectionChange,
    onColumnVisibilityChange,
    onColumnOrderChange,
    onColumnSizingChange,
    onColumnPinningChange: onColumnPinningChange as unknown as
      | OnChangeFn<TSTColumnPinning>
      | undefined,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    columnResizeMode: "onChange",
    enableColumnResizing: allowResize,
    pageCount,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalTableWidth = useMemo(
    () => visibleLeafColumns.reduce((acc, col) => acc + col.getSize(), 0),
    [visibleLeafColumns],
  );

  // Visual-order column ids (left pinned → middle → right pinned), excluding
  // the __select__ column from range math (it's outside the range domain).
  const visualColumnIds = useMemo(() => {
    return visibleLeafColumns
      .map((c) => c.id)
      .filter((id) => id !== SELECT_COLUMN_ID);
  }, [visibleLeafColumns]);

  // Visible columns in visual order, as DataGridColumnDef — used to feed
  // onRangeCopy's columns slice.
  const visibleDgColumns = useMemo(() => {
    const byId = new Map(dgColumns.map((c) => [c.id, c]));
    return visualColumnIds
      .map((id) => byId.get(id))
      .filter((c): c is DataGridColumnDef<TRow> => c !== undefined);
  }, [visualColumnIds, dgColumns]);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  useImperativeHandle(
    ref,
    (): DataGridHandle => ({
      scrollToRow: (rowIndex, options) => {
        rowVirtualizer.scrollToIndex(rowIndex, options);
      },
      scrollToTop: () => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      },
    }),
    [rowVirtualizer],
  );

  // Dev-mode unbounded-height warning. Vite substitutes process.env.NODE_ENV
  // at build time, so this branch compiles out of production bundles.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const el = bodyRef.current;
    if (!el) return;
    if (el.clientHeight === el.scrollHeight && data.length > 50) {
      console.warn(
        "[DataGrid] The scroll container has unbounded height " +
          "(clientHeight === scrollHeight) while rendering more than 50 rows. " +
          "This usually means an ancestor has `height: auto` or a flex child " +
          "is missing `min-height: 0`. See plan/09_component_readme.md " +
          '"Sizing" section for the integration pattern.',
      );
    }
  }, [data.length]);

  const featureFlags = useMemo<DataGridFeatureFlags>(
    () => ({
      sorting: allowSorting,
      pinning: allowPinning,
      reorder: allowReorder,
      resize: allowResize,
      columnVisibility: allowColumnVisibility,
      rowSelection: allowRowSelection,
      rangeSelection: allowRangeSelection,
      inlineEdit: allowInlineEdit,
    }),
    [
      allowSorting,
      allowPinning,
      allowReorder,
      allowResize,
      allowColumnVisibility,
      allowRowSelection,
      allowRangeSelection,
      allowInlineEdit,
    ],
  );

  // Page identity drives focused-cell + shift-click anchor resets. Anything
  // that semantically changes "what page of data am I looking at" must roll
  // into this. (Filter changes also bump pageIndex via useDataGrid, so we
  // catch them transitively.)
  const pageIdentity = useMemo(
    () =>
      `${pagination?.pageIndex ?? 0}:${pagination?.pageSize ?? 0}:${
        sorting
          ? sorting.map((s) => `${s.id}-${s.desc ? "d" : "a"}`).join(",")
          : ""
      }`,
    [pagination?.pageIndex, pagination?.pageSize, sorting],
  );

  // Resolve cell values for the copy ctx + TSV.
  const getCellValue = useCallback(
    (rowIndex: number, columnId: string): unknown => {
      const row = data[rowIndex];
      if (!row) return undefined;
      const col = dgColumns.find((c) => c.id === columnId);
      if (!col) return undefined;
      return col.accessor(row);
    },
    [data, dgColumns],
  );

  const range = useCellRangeSelection<TRow>({
    enabled: allowRangeSelection,
    bodyRef,
    cellRangeSelection: cellRangeSelection ?? null,
    onCellRangeSelectionChange: onCellRangeSelectionChange
      ? (next) => {
          // Updater is value or fn; we always pass a value here.
          (onCellRangeSelectionChange as (n: typeof next) => void)(next);
        }
      : undefined,
    visualColumnIds,
    visibleColumns: visibleDgColumns,
    rowCount: data.length,
    pageIdentity,
    getCellValue,
    onRangeContextMenu,
    onRangeCopy,
  });

  // Row selection helpers. Page row ids in render order — not the selected
  // ids, but every visible row's id.
  const pageRowIds = useMemo(
    () => data.map((row) => getRowId(row)),
    [data, getRowId],
  );

  const rowSel = useRowSelection({
    enabled: allowRowSelection,
    pageRowIds,
    rowSelection: rowSelection ?? {},
    onRowSelectionChange: onRowSelectionChange
      ? (next) => (onRowSelectionChange as (n: typeof next) => void)(next)
      : undefined,
    pageIdentity,
  });

  // Range visibility-change reconciliation: if the active range covers a
  // column that just became hidden, clear the range. Done in DataGrid (not
  // the hook) because visibility is a column-config concern the hook doesn't
  // see directly.
  const lastVisualIdsRef = useRef(visualColumnIds);
  useEffect(() => {
    const prev = lastVisualIdsRef.current;
    lastVisualIdsRef.current = visualColumnIds;
    if (!cellRangeSelection || !onCellRangeSelectionChange) return;
    const stillPresent = (id: string) => visualColumnIds.includes(id);
    if (
      !stillPresent(cellRangeSelection.anchor.columnId) ||
      !stillPresent(cellRangeSelection.focus.columnId)
    ) {
      (onCellRangeSelectionChange as (n: null) => void)(null);
      return;
    }
    // Also clear if a column inside the rectangle was removed.
    const aIdx = prev.indexOf(cellRangeSelection.anchor.columnId);
    const fIdx = prev.indexOf(cellRangeSelection.focus.columnId);
    if (aIdx < 0 || fIdx < 0) return;
    const rangeIds = prev.slice(Math.min(aIdx, fIdx), Math.max(aIdx, fIdx) + 1);
    for (const id of rangeIds) {
      if (!stillPresent(id)) {
        (onCellRangeSelectionChange as (n: null) => void)(null);
        return;
      }
    }
  }, [visualColumnIds, cellRangeSelection, onCellRangeSelectionChange]);

  const cellMouseHandlers = useMemo(
    () => ({
      onCellMouseDown: range.onCellMouseDown,
      onCellMouseEnter: range.onCellMouseEnter,
      onCellContextMenu: range.onCellContextMenu,
    }),
    [range.onCellMouseDown, range.onCellMouseEnter, range.onCellContextMenu],
  );

  const resolvedExtras = cellExtras ?? EMPTY_EXTRAS;
  const contextValue = useMemo<DataGridContextValue>(
    () => ({
      cellExtras: resolvedExtras,
      featureFlags,
      cellMouseHandlers,
      toggleRow: rowSel.toggleRow,
    }),
    [resolvedExtras, featureFlags, cellMouseHandlers, rowSel.toggleRow],
  );

  const headerSelectionValue = useMemo(
    () => ({
      state: rowSel.headerState,
      toggleAll: rowSel.toggleAll,
    }),
    [rowSel.headerState, rowSel.toggleAll],
  );

  // Sticky scroll shadows. Single scroll listener toggles classes on the
  // root based on horizontal scroll position. Avoids per-frame React re-renders.
  const [edgeShadows, setEdgeShadows] = useState({
    left: false,
    right: false,
  });
  const edgeShadowsRef = useRef(edgeShadows);
  edgeShadowsRef.current = edgeShadows;

  const recomputeShadows = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const left = el.scrollLeft > 0;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    const cur = edgeShadowsRef.current;
    if (cur.left !== left || cur.right !== right) {
      setEdgeShadows({ left, right });
    }
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => recomputeShadows();
    el.addEventListener("scroll", onScroll, { passive: true });
    // Initial pass + recompute on resize (e.g. layout settle).
    recomputeShadows();
    const ro = new ResizeObserver(() => recomputeShadows());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [recomputeShadows]);

  // Recompute when totalTableWidth changes (column add/remove/resize).
  useLayoutEffect(() => {
    recomputeShadows();
  }, [totalTableWidth, recomputeShadows]);

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  const showSkeleton = isLoading && data.length === 0;
  const showEmptyState = !isLoading && data.length === 0;
  const showRefetchBar = isLoading && data.length > 0;

  return (
    <DataGridContext.Provider value={contextValue}>
      <HeaderSelectionContext.Provider value={headerSelectionValue}>
        <div
          className={clsx(
            styles.root,
            edgeShadows.left && styles.rootShadowLeft,
            edgeShadows.right && styles.rootShadowRight,
            className,
          )}
        >
          {showRefetchBar && <div className={styles.refetchBar} />}
          <div
            ref={bodyRef}
            className={styles.scrollContainer}
            tabIndex={0}
            onKeyDown={range.onBodyKeyDown}
          >
            {headerGroups.map((hg) => (
              <HeaderRow
                key={hg.id}
                headers={hg.headers}
                height={headerHeight}
                totalWidth={totalTableWidth}
              />
            ))}
            <div
              className={styles.virtualSpacer}
              style={{
                height: data.length === 0 ? "100%" : `${totalSize}px`,
                width: `${totalTableWidth}px`,
                minWidth: `${totalTableWidth}px`,
              }}
            >
              {!showSkeleton &&
                virtualRows.map((vr) => {
                  const row = rowModel.rows[vr.index];
                  if (!row) return null;
                  return (
                    <VirtualRow
                      key={row.id}
                      row={row}
                      top={vr.start}
                      height={rowHeight}
                      totalWidth={totalTableWidth}
                      cellRangeSelection={cellRangeSelection ?? null}
                      visualColumnIds={visualColumnIds}
                    />
                  );
                })}
              {showSkeleton && (
                <SkeletonRows
                  totalWidth={totalTableWidth}
                  rowHeight={rowHeight}
                />
              )}
              {showEmptyState && (
                <div className={styles.emptyState}>
                  {emptyState ?? "No results"}
                </div>
              )}
            </div>
          </div>
        </div>
      </HeaderSelectionContext.Provider>
    </DataGridContext.Provider>
  );
}

function SkeletonRows({
  totalWidth,
  rowHeight,
}: {
  totalWidth: number;
  rowHeight: number;
}) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={styles.skeletonRow}
          style={{
            top: i * rowHeight,
            height: rowHeight,
            width: totalWidth,
            minWidth: totalWidth,
          }}
          aria-hidden
        >
          <div className={styles.skeletonShimmer} />
        </div>
      ))}
    </>
  );
}

type DataGridComponent = <TRow>(
  props: DataGridProps<TRow> & { ref?: ForwardedRef<DataGridHandle> },
) => ReactElement;

export const DataGrid = forwardRef(DataGridInner) as DataGridComponent;
