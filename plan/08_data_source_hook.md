# 08 — Core Hook: `useDataGrid`

## Purpose

Headless state-management hook. Owns: state shape for the view, transition rules, internal transient state (row/cell range selection, active editor), `gridProps` assembly.

Does NOT own: data fetching, URL state, persistence, column def construction, cell renderers, BE schema knowledge. Pages own all of that.

## Contract

```ts
function useDataGrid<TRow, TFilters>(options: {
  // Fully-controlled external state
  view: DataGridView<TFilters>;
  onViewChange: (next: DataGridView<TFilters>) => void;
  columnConfig: ColumnConfigState;
  onColumnConfigChange: (next: ColumnConfigState) => void;

  // Data metadata
  rowCount: number; // total rows server-side, for pagination UI

  // Column constraints (enforced in semantic setters and gridProps change handlers)
  maxVisibleColumns?: number; // default 40
  fixedVisibleColumnIds?: string[];
  fixedPositionColumnIds?: string[];
  fixedPinnedLeft?: string[];
  fixedPinnedRight?: string[];

  // Feature flags (propagated into gridProps)
  allowSorting?: boolean;
  allowPinning?: boolean;
  allowReorder?: boolean;
  allowResize?: boolean;
  allowColumnVisibility?: boolean;
  allowRowSelection?: boolean;
  allowRangeSelection?: boolean;
  allowInlineEdit?: boolean; // default false in phase 1

  // Notification channel for rule rejections (e.g., "max 40 columns")
  onWarn?: (message: string) => void;
}): {
  // Spread onto <DataGrid />. Caller still supplies: data, columns, getRowId, cellExtras, isLoading.
  // (Columns carry their own `cell` components inline — there is no separate cellRenderers prop.)
  gridProps: Partial<DataGridProps<TRow>>;

  // Semantic setters encode the transition rules
  setPage: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sorting: SortingState) => void;
  setFilters: (filters: TFilters) => void;

  // Transient state access (owned by the hook, not persisted)
  selection: {
    rowIds: string[];
    clear: () => void;
  };
  rangeSelection: {
    current: CellRangeSelection | null;
    clear: () => void;
  };
};
```

```ts
type DataGridView<TFilters> = {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState; // TanStack shape; single-column in v1
  filters: TFilters; // generic — caller types this
};
```

## State ownership

| State                | Owner                     | Persistence strategy                                                |
| -------------------- | ------------------------- | ------------------------------------------------------------------- |
| `view`               | External (controlled)     | Page chooses (URL / localStorage / server / memory)                 |
| `columnConfig`       | External (controlled)     | Page chooses — `useLocalStorageColumnConfig` is the shipped default |
| `rowSelection`       | Internal to `useDataGrid` | Transient; cleared on sort/filter change                            |
| `cellRangeSelection` | Internal to `useDataGrid` | Transient; cleared on page/sort/filter change                       |
| `activeEditor`       | Internal (phase 1)        | Transient. Phase 2 may lift to controlled if a consumer needs it.   |

## Transition rules (baked into semantic setters)

Confirmed with the user:

| Event                         | pageIndex | rowSelection | cellRangeSelection                         |
| ----------------------------- | --------- | ------------ | ------------------------------------------ |
| `setPage(i)`                  | → i       | preserved    | cleared                                    |
| `setPageSize(n)`              | → 0       | preserved    | cleared                                    |
| `setSort(s)`                  | → 0       | **cleared**  | cleared                                    |
| `setFilters(f)`               | → 0       | **cleared**  | cleared                                    |
| column visibility change      | unchanged | preserved    | cleared if range spans a now-hidden column |
| column reorder / resize / pin | unchanged | preserved    | preserved                                  |

These rules live inside `useDataGrid` and are non-negotiable. A page that wants different semantics writes its own wrapper — but then it's off the happy path.

## How transitions flow

The `<DataGrid />` component emits `onXxxChange` on user action. Inside `useDataGrid`, these callbacks route through the semantic setters:

```ts
// Inside useDataGrid
const setSort = useCallback(
  (nextSort: SortingState) => {
    onViewChange({ ...view, sorting: nextSort, pageIndex: 0 });
    setRowSelectionInternal({});
    setRangeSelectionInternal(null);
  },
  [view, onViewChange],
);

const onSortingChangeForGrid: OnChangeFn<SortingState> = (updater) => {
  const next = typeof updater === "function" ? updater(view.sorting) : updater;
  setSort(next);
};
```

The grid component never touches transition rules — it just fires events.

## Column config mutations with constraint enforcement

```ts
const onColumnVisibilityChangeForGrid: OnChangeFn<Record<string, boolean>> = (
  updater,
) => {
  const next =
    typeof updater === "function"
      ? updater(columnConfig.columnVisibility)
      : updater;
  const trueCount = Object.values(next).filter(Boolean).length;
  if (trueCount > maxVisibleColumns) {
    onWarn?.(`Maximum ${maxVisibleColumns} columns visible`);
    return; // reject the update entirely
  }
  // Force fixedVisibleColumnIds back to true in case they got turned off
  const enforced = { ...next };
  for (const id of fixedVisibleColumnIds ?? []) enforced[id] = true;
  onColumnConfigChange({ ...columnConfig, columnVisibility: enforced });
};
```

Similar enforcement for `columnPinning` (can't unpin fixed), `columnOrder` (can't move fixed-position), and `columnSizing` (clamp to min/max — though min/max lives per-column in `DataGridColumnDef`, so the hook only rejects if values fall outside absolute bounds).

## Integration examples

### A) Products page — keeps existing URL reconciliation logic unchanged

```tsx
function ProductsPage() {
  // Team's existing production hook. Handles filterView=xxx + raw params + reconciliation.
  // Unchanged by this refactor.
  const [view, setView] = useProductsUrlView();

  const [columnConfig, setColumnConfig] = useLocalStorageColumnConfig(
    "products-grid-v1",
    {
      maxVisibleColumns: 40,
      fixedVisibleColumnIds: ["sku.id", "product.name"],
      fixedPins: {
        left: ["sku.id", "product.name"],
        right: ["row.actions"],
      },
    },
  );

  const { data: attrs } = useAttributesQuery();
  const { data, isLoading } = useProductsQuery(view);
  const columns = useMemo(() => buildProductColumns(attrs ?? []), [attrs]);

  const grid = useDataGrid<Product, ProductFilters>({
    view,
    onViewChange: setView,
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: data?.total ?? 0,
    maxVisibleColumns: 40,
    fixedVisibleColumnIds: ["sku.id", "product.name"],
    fixedPinnedLeft: ["sku.id", "product.name"],
    fixedPinnedRight: ["row.actions"],
  });

  return (
    <>
      <ProductFilterBar value={view.filters} onApply={grid.setFilters} />
      <DataGrid
        {...grid.gridProps}
        data={data?.items ?? []}
        isLoading={isLoading}
        getRowId={(row) => row.skuId}
        columns={columns}
        cellExtras={{ onProductClick }}
      />
      <Pagination
        pageIndex={view.pageIndex}
        pageSize={view.pageSize}
        total={data?.total ?? 0}
        onPageChange={grid.setPage}
        onPageSizeChange={grid.setPageSize}
      />
    </>
  );
}
```

#### Products column construction

The Products page maps each `Attribute` to a cell component and builds `DataGridColumnDef[]`. The grid never sees `Attribute.type` — the mapping is entirely on the page side.

> **Phase 1 note.** Phase 1 ships only `TextCell`. The `mapAttrToCell` below is the **future-state** design, kept here so integrators know what the mapping will look like once richer cells exist. In phase 1, every branch resolves to `TextCell` — either inline the fallback or write per-column custom cells for anything that needs type-aware rendering.

```ts
import {
  TextCell, NumberCell, SingleSelectCell, MultiSelectCell,
  BooleanCell, DateCell, DateTimeCell, type CellRenderer,
} from '@/components/DataGrid'
// Phase 1 only exports TextCell. The other imports are illustrative of the
// future library surface and will not resolve until those cells ship.

// Domain type → grid cell component. Lives in the Products page code, not the grid library.
function mapAttrToCell(attrType: Attribute['type']): CellRenderer<Product> {
  switch (attrType) {
    case 'TEXT':          return TextCell
    case 'NUMBER':        return NumberCell        // future
    case 'SINGLE_SELECT': return SingleSelectCell  // future
    case 'MULTI_SELECT':  return MultiSelectCell   // future
    case 'BOOLEAN':       return BooleanCell       // future
    case 'DATE':          return DateCell          // future
    case 'DATETIME':      return DateTimeCell      // future
    case 'RICH_TEXT':     return TextCell
  }
}

// Per-column custom renderer for SKU id — no registry needed, inline reference.
const SkuLinkCell: CellRenderer<Product, string> = ({ value, extras }) => (
  <a onClick={() => (extras.onProductClick as any)?.(value)}>{value}</a>
)

function buildProductColumns(attributes: Attribute[]): DataGridColumnDef<Product>[] {
  const cols: DataGridColumnDef<Product>[] = []

  // Fixed pinned-left: SKU ID with a custom link cell
  cols.push({
    id: 'sku.id',
    header: 'SKU ID',
    accessor: (row) => row.skuId,
    cell: SkuLinkCell,
    pin: 'left',
    fixedPin: true,
    fixedVisible: true,
    fixedPosition: true,
    width: 140,
  })

  // Fixed pinned-left: Product Name (plain text)
  cols.push({
    id: 'product.name',
    header: 'Product Name',
    accessor: (row) => row.name,
    cell: TextCell,
    pin: 'left',
    fixedPin: true,
    fixedVisible: true,
    width: 240,
  })

  // Dynamic middle: every attribute, mapped via mapAttrToCell
  for (const attr of attributes) {
    cols.push({
      id: `attr.${attr.id}`,
      header: attr.name,
      accessor: (row) => row.attributes[attr.id]?.value,
      cell: mapAttrToCell(attr.type),
      align: attr.type === 'NUMBER' ? 'right' : undefined,
      editable: attr.type !== 'RICH_TEXT' && attr.isEditable,
      width: 160,
      meta: { sortable: attr.isSortable },
    })
  }

  // Fixed pinned-right: Actions (consumer provides a custom cell that reads row + extras)
  cols.push({
    id: 'row.actions',
    header: '',
    accessor: () => null,
    cell: ({ row, extras }) => (extras.renderRowActions as any)?.(row) ?? null,
    pin: 'right',
    fixedPin: true,
    fixedVisible: true,
    fixedPosition: true,
    width: 80,
    meta: { sortable: false },
  })

  return cols
}
```

Note how per-column customization (SKU link, row actions) lives directly on the column def — no `cellRenderers.byKey` registry. The `cellExtras` passthrough is still used for handlers like `onProductClick` and `renderRowActions`.

### B) Orders page — no URL state, plain React state

```tsx
function OrdersPage() {
  const [view, setView] = useState<DataGridView<OrderFilters>>({
    pageIndex: 0,
    pageSize: 50,
    sorting: [],
    filters: { status: "open" },
  });
  const [columnConfig, setColumnConfig] =
    useLocalStorageColumnConfig("orders-grid-v1");

  const { data, isLoading } = useQuery(["orders", view], () =>
    fetchOrders(view),
  );

  const grid = useDataGrid<Order, OrderFilters>({
    view,
    onViewChange: setView,
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: data?.total ?? 0,
  });

  return (
    <>
      <OrderFilterBar value={view.filters} onChange={grid.setFilters} />
      <DataGrid
        {...grid.gridProps}
        data={data?.items ?? []}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        columns={orderColumns}
      />
      <Pagination
        pageIndex={view.pageIndex}
        pageSize={view.pageSize}
        total={data?.total ?? 0}
        onPageChange={grid.setPage}
      />
    </>
  );
}
```

Refresh loses view state. Fine for this page.

### C) Drawer / modal usage — no persistence at all, most features off

```tsx
function ProductPickerDrawer({ onPick }: { onPick: (p: Product) => void }) {
  const [view, setView] = useState<DataGridView<{}>>({
    pageIndex: 0,
    pageSize: 20,
    sorting: [],
    filters: {},
  });
  const [columnConfig, setColumnConfig] =
    useState<ColumnConfigState>(defaultPickerConfig);

  const { data } = useQuery(["products.pick", view], () => fetchProducts(view));

  const grid = useDataGrid({
    view,
    onViewChange: setView,
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: data?.total ?? 0,
    allowColumnVisibility: false,
    allowPinning: false,
    allowResize: false,
    allowReorder: false,
    allowRangeSelection: false,
  });

  return (
    <DataGrid
      {...grid.gridProps}
      data={data?.items ?? []}
      getRowId={(r) => r.id}
      columns={pickerColumns}
    />
  );
}
```

Same `useDataGrid`, minimal config. No persistence. Most interactive features disabled to keep the drawer focused.

## What the hook does NOT do

- **No data fetching.** Caller owns the query and passes `data` + `rowCount` + `isLoading` to `<DataGrid />`.
- **No column def construction.** Caller builds `columns`.
- **No cell renderer definitions.** Caller sets `cell` on each column. Built-in cells are exported from the library but consumers import and pass them explicitly. See `06_cell_rendering.md`.
- **No URL state.** Caller owns the URL wire format.
- **No BE schema awareness.** Filters are typed via the `TFilters` generic; the hook passes them through.
- **No toast / notification UI.** Column config violations call the injected `onWarn`.

## Open / TBD

- **`activeEditor` controlled vs internal.** Internal in phase 1. Lift to controlled only when a phase 2 consumer needs it (e.g., "show the editor in a side drawer instead of inline").
- **Should `setFilters` accept an updater function?** TanStack convention is `T | (prev: T) => T`. I'd match. The contract above takes a value for brevity — widen when implementing.
- **Row selection across pages.** Preserved across `setPage` per the transition table. Flag if this is wrong for your UX.
- **Column visibility range-clear.** If a range spans a column the user hides, the range clears. Alternative is "preserve but skip hidden column" — messier. I default to clear.
- **Rename this file to `08_core_hook.md`?** The filename is from the earlier draft when this was the Products data-source hook. Flag for a follow-up rename.
