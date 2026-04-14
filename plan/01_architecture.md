# 01 — Architecture

## Component boundaries

**Layer 1: `<DataGrid />`** — generic presentation component.

- Props-in, callbacks-out. Fully controlled.
- Handles virtualization, three-zone layout, pinned columns, horizontal scroll sync, cell rendering via the registry, selection interactions, drag/resize/reorder UIs.
- No knowledge of BE, URL, localStorage, or state transition rules.
- Lives in `src/components/DataGrid/`.

**Layer 2: `useDataGrid`** — headless state hook.

- Takes `view` + `columnConfig` as controlled external state, plus `rowCount` and feature flags (see full contract in `08_data_source_hook.md`).
- Owns transition rules: `setSort` / `setFilters` reset `pageIndex` to 0 and clear row selection; `setPageSize` resets page; all of them clear the cell range.
- Owns internal transient state (row selection, cell range selection, active editor).
- Returns `gridProps` (to spread onto `<DataGrid />`) plus semantic setters and transient-state accessors.
- No knowledge of persistence, BE, columns, renderers, or the URL.
- Lives in `src/hooks/useDataGrid.ts`.

**Layer 3: Page code** — owns everything external.

- BE fetching (`useQuery` or whatever).
- URL state — the team's existing `useProductsUrlView` on the Products page, plain `useState` elsewhere, or anything in between.
- Filter state storage and reconciliation rules.
- Column def construction.
- Cell renderer wiring.
- Optional: `useLocalStorageColumnConfig(tableInstanceId)` for the universal column-config-in-localStorage pattern.

## Prop contract (shape only — specifics in subsequent files)

```ts
type DataGridProps<TRow> = {
  // Data
  data: TRow[]
  rowCount: number            // total rows server-side (for pagination UI)
  getRowId: (row: TRow) => string
  isLoading?: boolean

  // Columns
  columns: DataGridColumnDef<TRow>[]

  // Controlled state (each optional; omit for uncontrolled)
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>

  pagination?: { pageIndex: number; pageSize: number }
  onPaginationChange?: OnChangeFn<{ pageIndex: number; pageSize: number }>

  rowSelection?: Record<string, boolean>
  onRowSelectionChange?: OnChangeFn<Record<string, boolean>>

  cellRangeSelection?: CellRangeSelection | null
  onCellRangeSelectionChange?: OnChangeFn<CellRangeSelection | null>

  columnVisibility?: Record<string, boolean>
  onColumnVisibilityChange?: OnChangeFn<Record<string, boolean>>

  columnOrder?: string[]
  onColumnOrderChange?: OnChangeFn<string[]>

  columnSizing?: Record<string, number>
  onColumnSizingChange?: OnChangeFn<Record<string, number>>

  columnPinning?: { left: string[]; right: string[] }
  onColumnPinningChange?: OnChangeFn<{ left: string[]; right: string[] }>

  // Phase 2 seam — active edit cell + draft value lives above the virtualizer
  activeEditor?: { rowId: string; columnId: string; draftValue: unknown } | null
  onActiveEditorChange?: OnChangeFn<{ rowId: string; columnId: string; draftValue: unknown } | null>

  // Feature flags (default true unless noted)
  allowSorting?: boolean
  allowPinning?: boolean
  allowReorder?: boolean
  allowResize?: boolean
  allowColumnVisibility?: boolean
  allowRowSelection?: boolean
  allowRangeSelection?: boolean
  allowInlineEdit?: boolean        // default FALSE in phase 1

  // Visual
  rowHeight?: number               // default 40
  headerHeight?: number            // default 40
  overscan?: number                // default 10 rows

  // Renderer registries
  cellRenderers?: {
    byKey?: Record<string, CellRenderer<TRow>>
    byType?: Record<string, CellRenderer<TRow>>
  }
  cellExtras?: Record<string, unknown>   // passthrough to cells (e.g. onProductClick)

  // Callbacks (phase 1)
  onRangeContextMenu?: (e: MouseEvent, range: CellRange) => void
  onRangeCopy?: (range: CellRange, tsv: string) => void

  // Visual slots
  emptyState?: ReactNode
  className?: string
}
```

## Column def

```ts
type DataGridColumnDef<TRow> = {
  id: string
  header: string | ((ctx: HeaderContext<TRow>) => ReactNode)
  accessor: (row: TRow) => unknown
  type: AttributeType   // 'text' | 'number' | 'single-select' | 'multi-select' | 'rtf' | 'boolean' | 'date' | 'datetime' | ...

  width?: number        // default 160
  minWidth?: number     // default 60
  maxWidth?: number     // default 800

  // Pinning
  pin?: 'left' | 'right' | null   // initial pin set by the column def (treated as fixed if fixedPin is true)
  fixedPin?: boolean              // user cannot unpin or change pin side
  fixedPosition?: boolean         // user cannot reorder (acts as a wall within its zone)
  fixedVisible?: boolean          // user cannot hide (checkbox disabled + checked in the config modal)

  // Phase 2
  editable?: boolean

  // Metadata
  meta?: {
    sortable?: boolean            // default true if allowSorting is on
    isSystemAttribute?: boolean
    [k: string]: unknown
  }
}
```

### Why three separate `fixed*` flags

Your requirements map cleanly to three orthogonal constraints:
- "Product Name is always shown" → `fixedVisible: true`
- "SKU ID is pinned left by us, user cannot unpin" → `fixedPin: true, pin: 'left'`
- "Actions column cannot be moved away from the far right" → `fixedPin: true, pin: 'right', fixedPosition: true`

A column can have any combination (e.g., `fixedVisible: true` but user-movable, or `fixedPin: left` but user-hideable).

## Feature flags — what each disables

| Flag | Default | When `false` |
|---|---|---|
| `allowSorting` | true | Header clicks don't sort; sort arrows hidden. |
| `allowPinning` | true | No pin/unpin options in header menu. Column-def `pin` + `fixedPin` still honored. |
| `allowReorder` | true | No drag handles; no "move left/right" in header menu. |
| `allowResize` | true | No resize handles on headers. |
| `allowColumnVisibility` | true | Config modal still works if opened, but "hide" is not offered in the header menu. |
| `allowRowSelection` | true | No pinned-left checkbox column injected. |
| `allowRangeSelection` | true | Mouse drag doesn't start a range; `cellRangeSelection` ignored. |
| `allowInlineEdit` | **false** | `activeEditor` ignored. Cells never enter edit mode. Flip to `true` in phase 2. |

## Data flow

```
User action
    │
    ▼
<DataGrid /> emits onXxxChange(updater)
    │
    ▼
useDataGrid routes through a semantic setter (applies transition rules)
    │
    ├──(view slice)──▶ onViewChange(nextView) ─▶ page URL/storage ─▶ back in via view prop
    │                                                                       │
    │                                                              (page refetches data)
    │
    ├──(column config slice)──▶ onColumnConfigChange(next) ─▶ page persistence ─▶ back in
    │
    └──(transient: selection, active editor)─▶ hook-local state ─▶ back via gridProps
                                                                        │
                                                                        ▼
                                                             re-renders <DataGrid />
```

Every durable state change round-trips through the page. Transient state round-trips internally through `useDataGrid`. The grid has no internal source of truth beyond what the hook gives it.

## File layout (proposed)

```
src/components/DataGrid/
  DataGrid.tsx                 // top-level component
  DataGrid.types.ts            // DataGridProps, DataGridColumnDef, CellRenderer, etc.
  DataGrid.module.css
  header/
    HeaderRow.tsx
    HeaderCell.tsx
    HeaderMenu.tsx             // the 3-dots menu
    ResizeHandle.tsx
  body/
    BodyContainer.tsx
    VirtualRow.tsx
    BodyCell.tsx
  cells/
    DefaultCell.tsx
    TextCell.tsx
    NumberCell.tsx
    SingleSelectCell.tsx
    MultiSelectCell.tsx
    RTFCell.tsx
    BooleanCell.tsx
    DateCell.tsx
    CheckboxCell.tsx           // for row selection column
  selection/
    useCellRangeSelection.ts
    useRowSelection.ts
  dnd/
    ColumnReorderContext.tsx
  internal/
    useThreeTrackLayout.ts
    useHorizontalScrollSync.ts

src/hooks/
  useDataGrid.ts                 // the core hook — takes controlled view + columnConfig
  useDataGrid.types.ts           // DataGridView, ColumnConfigState, SemanticSetters, etc.
  useLocalStorageColumnConfig.ts // optional peer hook — the only shipped persistence helper

src/pages/products/              // example consumer — NOT part of the grid library
  ProductsPage.tsx
  useProductsUrlView.ts          // team's existing URL reconciliation logic (unchanged by this refactor)
  useProductsQuery.ts
  useAttributesQuery.ts
  buildProductColumns.ts         // plain function: (attributes) -> DataGridColumnDef[]
  productCellRenderers.tsx       // the byKey registry for SKU link / row actions / etc.
```

## Open / TBD

- **Export the TanStack Table instance?** Some consumers may want to reach into the underlying TanStack Table for advanced cases. I'd NOT export it from `useDataGrid` in v1 — keep the contract narrow. Add later if a concrete need appears.
- **`DataGridProps` as generic vs narrowed.** Export generic; consumers narrow per-screen.
- **Whether to separate `<DataGrid />` and `useDataGrid` into different npm entrypoints.** Only matters if this becomes a standalone package. Defer.
