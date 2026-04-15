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
  // (see 06_cell_rendering.md inline-edit architecture section)
  activeEditor?: { rowId: string; columnId: string; draftValue: unknown } | null
  onActiveEditorChange?: OnChangeFn<{ rowId: string; columnId: string; draftValue: unknown } | null>
  onCommitEdit?: (update: { rowId: string; columnId: string; value: unknown }) => void | Promise<void>

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

  // Consumer passthrough to cell renderers (e.g., onProductClick handlers).
  // There is NO cellRenderers prop — cell components are declared inline on each column
  // via `column.cell`. See `06_cell_rendering.md` for the rationale.
  cellExtras?: Record<string, unknown>

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
type DataGridColumnDef<TRow, TValue = unknown> = {
  id: string
  header: string | ((ctx: HeaderContext<TRow>) => ReactNode)
  accessor: (row: TRow) => TValue

  // Rendering — NO type enum. Consumers pass a component directly, or rely on TextCell.
  cell?: CellRenderer<TRow, TValue>   // defaults to TextCell (renders String(value ?? ''))
  align?: 'left' | 'right' | 'center' // pure styling hint, honored by TextCell

  // Sizing
  width?: number        // default 160
  minWidth?: number     // default 60
  maxWidth?: number     // default 800

  // Pinning
  pin?: 'left' | 'right' | null   // initial pin set by the column def (treated as fixed if fixedPin is true)
  fixedPin?: boolean              // user cannot unpin or change pin side
  fixedPosition?: boolean         // user cannot reorder (acts as a wall within its zone)
  fixedVisible?: boolean          // user cannot hide (checkbox disabled + checked in the config modal)

  // Phase 2: grid wires dblclick/Enter to enter edit mode only when editable === true
  editable?: boolean

  // Metadata
  meta?: {
    sortable?: boolean            // default true if allowSorting is on
    [k: string]: unknown
  }
}
```

The grid ships **no `type` field** and **no cell registry**. Cells are declared directly on each column via `column.cell`. See `06_cell_rendering.md` for the full rationale and the list of built-in cell components that consumers import and pass in.

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

## State management

### Inventory

| State | Owner | Change frequency |
|---|---|---|
| `view` (page, sort, filters) | Page (external to the grid) | Low |
| `columnConfig` (visibility, order, sizing, pinning) | Page (external) | Low; medium during resize drag |
| `rowSelection` | `useDataGrid` internal | Low (click-driven) |
| `cellRangeSelection` | `useDataGrid` internal | **High during drag** (every mousemove) |
| `activeEditor` | `useDataGrid` internal | Low (enter/exit); `draftValue` changes per keystroke but only one cell cares |
| Scroll metrics (for sticky shadows) | `<DataGrid />` local ref | High but only the shadow divs re-render |
| TanStack Table instance | `<DataGrid />` local | Derived from the above |
| Cell-local UI (date picker open, etc.) | Cell component `useState` | Local, never leaks out |

### Prop drilling depth

Three levels max inside `<DataGrid />`:

```
<DataGrid />
  → HeaderRow → HeaderCell              (2 levels)
  → VirtualRow → BodyCell → cell        (3 levels)
```

Row-level props (`row`, `rowId`, `value`, `isInRange`) are per-cell — there's nothing to hoist into Context because they differ for every node anyway. Drilling them is fine.

### Context — one for stable shared state

One `DataGridContext` holds state that rarely or never changes during a render pass:

```ts
type DataGridContextValue<TRow> = {
  table: Table<TRow>               // the TanStack Table instance
  cellExtras: Record<string, unknown>  // consumer passthrough (onProductClick, etc.)
  featureFlags: {                  // the allow* flags, resolved
    sorting: boolean
    pinning: boolean
    reorder: boolean
    resize: boolean
    columnVisibility: boolean
    rowSelection: boolean
    rangeSelection: boolean
    inlineEdit: boolean
  }
  scrollMetricsRef: RefObject<{ scrollLeft: number; scrollWidth: number; clientWidth: number }>
}
```

- Provided at `<DataGrid />` top level.
- Consumed by `HeaderCell`, `BodyCell`, and cell components via a small `useDataGridContext()` hook.
- Avoids drilling `cellExtras` and feature flags through 3 levels of components.
- Changes rarely (feature flags never; table instance only on state updates that'd re-render everything anyway; scroll metrics via mutable ref, no re-render).

**Why this doesn't trigger the "Context causes re-render avalanche" problem:** the value is memoized upfront (stable `table` ref, stable `featureFlags` object, stable `scrollMetricsRef`). Context consumers re-render only when the memoized object identity changes — which happens on the same intervals as the component tree already re-renders.

### No external store in phase 1

Hot state (`cellRangeSelection` during drag, `activeEditor` draft changes) uses plain prop drilling + `React.memo` with shallow comparators on cell components. At 100 rows × 40 columns = 4000 cells, the per-mousemove re-render cost is expected to be acceptable after memoization short-circuits unchanged cells.

**If profiling shows range-drag is slow** (Chrome Performance flamegraph, not vibes), add a tiny `useSyncExternalStore`-based selection store:

- ~30 lines, zero dependencies
- Cells subscribe to a selector: `useCellIsInRange(rowIndex, columnId)` → `boolean`
- Only cells whose derived boolean changed re-render
- Cuts work from O(all visible cells) to O(range perimeter)
- Migration is internal to `<DataGrid />` — cell component API does not change

This is the only state-management pattern we'd add later. **Not shipping it in phase 1.** Don't pre-optimize a problem that might not exist at our scale.

### Explicitly rejected

- **Redux / Jotai / Zustand.** Overkill for a single component's internal state. `useDataGrid` + `DataGridContext` covers everything durable. A custom `useSyncExternalStore` covers hot state only if needed.
- **Global state.** The grid can be instantiated multiple times on the same page; nothing grid-owned touches module-level singletons.
- **Context for hot state** (range selection, draft values). Vanilla `React.createContext` triggers a re-render on every change for every consumer — exactly what we want to avoid. If we need a "store-shaped Context," that's the `useSyncExternalStore` pattern above, not plain Context.

### What this means for session implementers

- **Session 1 (`useDataGrid`):** zero Context, zero stores. `useState` + memoized setters. The hook stays dumb.
- **Session 2 (`<DataGrid />`):** create `DataGridContext` at the component top. Memoize its value. All cell / header components consume via `useDataGridContext()` for stable shared state. Prop-drill everything else.
- **Session 4 (selection):** plain prop drilling + `React.memo`. Do NOT reach for a store unless you've profiled and it's clearly the bottleneck. If it is, the store pattern lives inside `<DataGrid />`'s internals — doesn't touch the public cell component API.

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
    TextCell.tsx               // the only built-in cell in phase 1; also serves as the fallback
    CheckboxCell.tsx           // for the row selection column (session 4)
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
  productCells.tsx               // custom cell components: SkuLinkCell, RowActionsCell, etc.
```

## Open / TBD

- **Export the TanStack Table instance?** Some consumers may want to reach into the underlying TanStack Table for advanced cases. I'd NOT export it from `useDataGrid` in v1 — keep the contract narrow. Add later if a concrete need appears.
- **`DataGridProps` as generic vs narrowed.** Export generic; consumers narrow per-screen.
- **Whether to separate `<DataGrid />` and `useDataGrid` into different npm entrypoints.** Only matters if this becomes a standalone package. Defer.
