# 02 — Table Component (`<DataGrid />`)

## Responsibility
Render the grid, manage the TanStack Table instance, lay out the sticky header + pinned columns inside a single scroll container, delegate row rendering to the virtualizer, delegate cell rendering to the registry. Owns single-column sort UI. Fills its parent container — caller is responsible for providing bounded dimensions.

## Library choices

| Library | Purpose |
|---|---|
| `@tanstack/react-table` v8 | Headless table state (columns, sort, visibility, sizing, pinning, order). |
| `@tanstack/react-virtual` v3 | Row virtualization only. |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Column reorder DnD. |
| `clsx` | Class merging. |
| No antd | Not in the framework. OK inside consumer-supplied cell renderers. |

## Sizing

The grid fills its container. Caller provides a bounded parent. `<DataGrid />` is `display: flex; flex-direction: column; width: 100%; height: 100%`. No `width` / `height` props.

Typical integrations:

```tsx
// A) Full-height page with a flex chain
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  <TopBar />
  <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
    <DataGrid ... />
  </div>
</div>

// B) Fixed-height container
<div style={{ height: 600 }}>
  <DataGrid ... />
</div>

// C) Inside a drawer / modal with a known content area
<Drawer bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
  <DataGrid ... />
</Drawer>
```

**The #1 integration gotcha:** if any ancestor in the chain has `height: auto`, the grid's scroll container has unbounded height, the virtualizer thinks it has infinite space, and every row renders at once. The usual cause is a flex child missing `min-height: 0`. Document this in the component's prop docs and in the example integrations. Consider a runtime dev-mode warning: on mount, if `bodyRef.current.clientHeight === bodyRef.current.scrollHeight && data.length > 50`, log a warning pointing at this gotcha.

## Internal structure

**One scroll container. Sticky header inside it. Pinned columns use `position: sticky` on cells.** This replaces earlier three-rail + JS-scroll-sync drafts — it's simpler, pure CSS, and scales naturally with virtualization.

```
<DataGrid> (display: flex, flex-direction: column, width: 100%, height: 100%, overflow: hidden)
  <ScrollContainer ref={bodyRef}>            ← flex: 1, min-height: 0, overflow: auto
    <Header>                                 ← position: sticky, top: 0, z-index: 2,
                                                display: flex, height: headerHeight,
                                                width: totalTableWidth
      <HeaderCell id="sku.id" pinned="left"/>      ← position: sticky, left: 0, z-index: 3
      <HeaderCell id="product.name" pinned="left"/> ← position: sticky, left: leftOffset, z-index: 3
      <HeaderCell id="attr.color"/>                 ← normal flow
      <HeaderCell id="attr.size"/>                  ← normal flow
      <HeaderCell id="row.actions" pinned="right"/> ← position: sticky, right: 0, z-index: 3
    </Header>

    <VirtualSpacer>                          ← position: relative,
                                                height: rowVirtualizer.getTotalSize(),
                                                width: totalTableWidth
      {virtualRows.map(vr =>
        <Row>                                ← position: absolute, top: vr.start, left: 0,
                                                width: totalTableWidth, display: flex,
                                                height: rowHeight
          <Cell id="sku.id" pinned="left"/>         ← position: sticky, left: 0, z-index: 1
          <Cell id="product.name" pinned="left"/>   ← position: sticky, left: leftOffset, z-index: 1
          <Cell id="attr.color"/>                   ← normal flow
          <Cell id="attr.size"/>                    ← normal flow
          <Cell id="row.actions" pinned="right"/>   ← position: sticky, right: 0, z-index: 1
        </Row>
      )}
    </VirtualSpacer>
  </ScrollContainer>
</DataGrid>
```

Two children of `ScrollContainer`: the sticky header and the virtual spacer. That's it.

### Why sticky header + sticky cells (dropped the three-rail approach)

- **One scroll owner, not two.** Header and body cannot de-sync during jank because they share the same scroll container. No `scrollLeft` listener, no JS sync, no `rAF` throttling to worry about.
- **Pinned header corners "just work."** The top-left SKU header cell has `position: sticky; top: 0; left: 0` — sticky pins it in both axes simultaneously. No special "corner" logic.
- **Pure CSS scales with row count.** Adding virtualized rows doesn't change the layout primitive.

### Critical: do NOT use `transform` to position virtual rows

TanStack Virtual's docs often show `transform: translate3d(0, ${start}px, 0)` for virtual row positioning. **Don't use that here.** A transformed ancestor breaks `position: sticky` in Safari and older Chrome — the sticky header and sticky cells silently fail.

Use `top: ${vr.start}px` with `position: absolute` instead. Performance is equivalent for this use case (absolute positioning is compositor-friendly; `will-change: transform` does not help when we can't use transform).

### Z-index layers

| Element | z-index | Why |
|---|---|---|
| Pinned header cells (top corners) | 3 | Above everything else |
| Header row (non-pinned cells) | 2 | Above body rows |
| Pinned body cells | 1 | Above non-pinned body cells |
| Non-pinned body cells | 0 (default) | Baseline |

Background color is required on header cells and pinned cells so content below doesn't bleed through when they're sticky. Use a solid color matching the grid's background.

### Width management

- Each visible column has a width from `columnSizing` state (or default from `DataGridColumnDef.width`).
- `totalTableWidth = sum of all visible column widths` (including pinned).
- Header and each virtual row are `width: ${totalTableWidth}px`.
- If `totalTableWidth < ScrollContainer.clientWidth`, the table is left-aligned; empty space on the right. Acceptable default. "Flex last column to fill" as an opt-in per column — defer to v2.

### Left/right pinned offsets

Pinned-left cells use `position: sticky; left: N` where N is the cumulative width of all pinned-left columns to this one's left. Same for pinned-right from the right edge. Computed once per render from the column sizing state. Store as a `Map<columnId, number>` alongside column definitions.

## TanStack Table wiring

```ts
const table = useReactTable({
  data,
  columns: tanstackColumns,
  state: {
    sorting,
    rowSelection,
    columnVisibility,
    columnOrder,
    columnSizing,
    columnPinning,
    pagination,
  },
  onSortingChange,
  onRowSelectionChange,
  onColumnVisibilityChange,
  onColumnOrderChange,
  onColumnSizingChange,
  onColumnPinningChange,
  onPaginationChange,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,       // server-side
  manualSorting: true,          // server-side
  manualFiltering: true,        // filter UI is external
  columnResizeMode: 'onChange',
  getRowId,
})
```

- No `getSortedRowModel`, no `getFilteredRowModel`, no `getPaginationRowModel` — all server-side.
- `DataGridColumnDef` is mapped to TanStack `ColumnDef` inside the component (a thin adapter).

## Sort UX (single column, server-side)

- Header click cycles: no-sort → asc → desc → no-sort.
- Only one column sorted at a time. Clicking a new column replaces, not appends.
- Sort indicator (triangle ▲/▼) shown next to header label when active.
- Shift-click ignored in v1.
- `allowSorting: false` hides indicators and disables click handler.
- Per-column opt-out via `meta.sortable === false` (e.g., action column, multi-select columns that the BE doesn't support sorting on).

## Loading and empty states

| State | Render |
|---|---|
| `isLoading && data.length === 0` | Skeleton: 3 placeholder rows with shimmering cells. |
| `!isLoading && data.length === 0` | `emptyState` prop, or default "No results". |
| `isLoading && data.length > 0` | Keep current data; show a subtle 2px top-border "loading" bar. User is paginating while browsing. |

## Single-column sort — interaction with server

The grid calls `onSortingChange(next)`. `useDataGrid`'s `setSort` applies the transition rules (`pageIndex` → 0, clear row selection, clear range) and calls `onViewChange` — the page refetches from the updated `view`.

## Pagination controls

- The grid does NOT render a pagination footer. That's a page concern.
- The page renders its own footer using `view.pageIndex`, `view.pageSize`, `data?.total`, and `grid.setPage` / `grid.setPageSize` from `useDataGrid`.
- The grid receives `pagination` as a prop and calls `onPaginationChange` only when a keyboard shortcut or internal action changes it (none in phase 1).

## Open / TBD

- **Dev-mode warning for unbounded height.** On mount, detect `clientHeight === scrollHeight && data.length > 50` and log a clear warning pointing to the Sizing section. Worth the 5 lines of code — this gotcha will bite every new integrator.
- **Column groups / multi-level headers.** Out of scope v1.
- **Keyboard shortcut for "first/last page" inside the grid.** No — page footer owns it.
- **"Flex last column to fill"** when `totalTableWidth < ScrollContainer.clientWidth`. Opt-in per column (`DataGridColumnDef.flex: true`). Defer to v2.
- **Sticky shadow affordance.** Right edge of pinned-left and left edge of pinned-right should cast a subtle box-shadow when the user has scrolled horizontally (indicates "there's more beyond"). Detect via `scrollLeft > 0` and `scrollLeft < scrollWidth - clientWidth`. Small polish — include if cheap, defer if finicky.
