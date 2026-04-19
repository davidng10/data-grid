import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";

import { BodyRow } from "./components/body/BodyRow";
import { OverlayColumnShadow } from "./components/body/OverlapColumnShadow";
import { HeaderRow } from "./components/header/HeaderRow";
import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
  SELECT_COLUMN_ID,
} from "./constants";
import { useCellRangeSelection } from "./hooks/useCellRangeSelection";
import { useDataGridColumns } from "./hooks/useDataGridColumns";
import {
  DataGridActionsContext,
  DataGridConfigContext,
} from "./hooks/useDataGridContext";
import { HeaderSelectionContext } from "./hooks/useHeaderSelectionContext";
import { useRowSelection } from "./hooks/useRowSelection";
import { shouldClearRangeForVisibilityChange } from "./utils/rangeVisibility";

import type { ForwardedRef, ReactElement } from "react";
import type {
  DataGridActionsValue,
  DataGridConfigValue,
  DataGridFeatureFlags,
} from "./hooks/useDataGridContext";
import type { DataGridColumnDef, DataGridHandle, DataGridProps } from "./types";

import styles from "./DataGrid.module.css";

declare const process: { readonly env: { readonly NODE_ENV: string } };

type DataGridComponent = <TRow>(
  props: DataGridProps<TRow> & { ref?: ForwardedRef<DataGridHandle> },
) => ReactElement;

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
    allowSorting = false,
    allowPinning = false,
    allowReorder = false,
    allowResize = true,
    allowColumnVisibility = false,
    allowRowSelection = false,
    allowRangeSelection = false,
    allowInlineEdit = false,
    rowHeight = DEFAULT_ROW_HEIGHT,
    headerHeight = DEFAULT_HEADER_HEIGHT,
    overscan = DEFAULT_OVERSCAN,
    emptyState,
    className,
    onRangeContextMenu,
    onRangeCopy,
  } = props;

  const virtualSpacerRef = useRef<HTMLDivElement | null>(null);

  const { columns: tanstackColumns, columnPinning: effectiveColumnPinning } =
    useDataGridColumns({
      columns: dgColumns,
      columnPinning,
      allowRowSelection,
    });

  const pageCount = useMemo(() => {
    if (!pagination || pagination.pageSize <= 0) return -1;
    return Math.max(1, Math.ceil(rowCount / pagination.pageSize));
  }, [pagination, rowCount]);

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
    onColumnPinningChange,
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
  // column that just became hidden, clear the range. Lives here (not in the
  // hook) because visibility is a column-config concern useDataGrid doesn't
  // see directly. The decision predicate is a pure helper; the effect only
  // bridges prev/next visualColumnIds and dispatches the clear.
  const lastVisualIdsRef = useRef(visualColumnIds);
  useEffect(() => {
    const prev = lastVisualIdsRef.current;
    lastVisualIdsRef.current = visualColumnIds;
    if (!onCellRangeSelectionChange) return;
    if (
      shouldClearRangeForVisibilityChange(
        prev,
        visualColumnIds,
        cellRangeSelection ?? null,
      )
    ) {
      (onCellRangeSelectionChange as (n: null) => void)(null);
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

  const actionsValue = useMemo<DataGridActionsValue>(
    () => ({
      cellMouseHandlers,
      toggleRow: rowSel.toggleRow,
    }),
    [cellMouseHandlers, rowSel.toggleRow],
  );

  const configValue = useMemo<DataGridConfigValue>(
    () => ({
      featureFlags,
    }),
    [featureFlags],
  );

  const headerSelectionValue = useMemo(
    () => ({
      state: rowSel.headerState,
      toggleAll: rowSel.toggleAll,
    }),
    [rowSel.headerState, rowSel.toggleAll],
  );

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  const showSkeleton = isLoading && data.length === 0;
  const showEmptyState = !isLoading && data.length === 0;

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
          "is missing `min-height: 0`.",
      );
    }
  }, [data.length]);

  return (
    <DataGridConfigContext.Provider value={configValue}>
      <DataGridActionsContext.Provider value={actionsValue}>
        <HeaderSelectionContext.Provider value={headerSelectionValue}>
          <div className={clsx(styles.root, className)}>
            <div
              ref={bodyRef}
              className={styles.scrollContainer}
              tabIndex={0}
              onKeyDown={range.onBodyKeyDown}
            >
              <OverlayColumnShadow
                visibleLeafColumns={visibleLeafColumns}
                scrollContainerRef={bodyRef}
                virtualSpacerRef={virtualSpacerRef}
              />
              {headerGroups.map((hg) => (
                <HeaderRow
                  key={hg.id}
                  headers={hg.headers}
                  height={headerHeight}
                  totalWidth={totalTableWidth}
                />
              ))}
              <div
                ref={virtualSpacerRef}
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
                      <BodyRow
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
                {showEmptyState && (
                  <div className={styles.emptyState}>
                    {emptyState ?? "No results"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </HeaderSelectionContext.Provider>
      </DataGridActionsContext.Provider>
    </DataGridConfigContext.Provider>
  );
}

export const DataGrid = forwardRef(DataGridInner) as DataGridComponent;
