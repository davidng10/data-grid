import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ForwardedRef,
  type ReactElement,
} from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import type {
  DataGridColumnDef,
  DataGridHandle,
  DataGridProps,
} from "./DataGrid.types";
import {
  DataGridContextProvider,
  type DataGridContextValue,
  type DataGridFeatureFlags,
} from "./internal/DataGridContext";
import { HeaderRow } from "./header/HeaderRow";
import { VirtualRow } from "./body/VirtualRow";
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
        typeof headerDef === "string"
          ? headerDef
          : (ctx) => headerDef(ctx),
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
  } = props;

  const tanstackColumns = useMemo(
    () => toTanStackColumns(dgColumns),
    [dgColumns],
  );

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
      columnPinning: columnPinning as TSTColumnPinning | undefined,
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
    pageCount,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const totalTableWidth = useMemo(
    () => visibleLeafColumns.reduce((acc, col) => acc + col.getSize(), 0),
    [visibleLeafColumns],
  );

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

  const resolvedExtras = cellExtras ?? EMPTY_EXTRAS;
  const contextValue = useMemo<DataGridContextValue>(
    () => ({
      cellExtras: resolvedExtras,
      featureFlags,
    }),
    [resolvedExtras, featureFlags],
  );

  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();

  const showEmptyState = !isLoading && data.length === 0;

  return (
    <DataGridContextProvider value={contextValue}>
      <div className={clsx(styles.root, className)}>
        <div ref={bodyRef} className={styles.scrollContainer}>
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
            {virtualRows.map((vr) => {
              const row = rowModel.rows[vr.index];
              if (!row) return null;
              return (
                <VirtualRow
                  key={row.id}
                  row={row}
                  top={vr.start}
                  height={rowHeight}
                  totalWidth={totalTableWidth}
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
    </DataGridContextProvider>
  );
}

type DataGridComponent = <TRow>(
  props: DataGridProps<TRow> & { ref?: ForwardedRef<DataGridHandle> },
) => ReactElement;

export const DataGrid = forwardRef(DataGridInner) as DataGridComponent;
