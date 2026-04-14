# 02 — Table Component (`<DataGrid />`)

## Responsibility
Render the grid, manage the TanStack Table instance, lay out the three-track pinned structure, handle horizontal scroll sync, delegate row rendering to the virtualizer, delegate cell rendering to the registry. Owns single-column sort UI.

## Library choices

| Library | Purpose |
|---|---|
| `@tanstack/react-table` v8 | Headless table state (columns, sort, visibility, sizing, pinning, order). |
| `@tanstack/react-virtual` v3 | Row virtualization only. |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Column reorder DnD. |
| `clsx` | Class merging. |
| No antd | Not in the framework. OK inside consumer-supplied cell renderers. |

## Internal structure

```
<DataGrid>
  <HeaderRow>
    <PinnedLeftHeaders />
    <ScrollableHeaders ref={headerMiddleRef} />   ← horizontal scroll mirrors body
    <PinnedRightHeaders />
  </HeaderRow>
  <BodyContainer ref={bodyRef}>                   ← vertical scroll owner
    <TotalHeightSpacer style={{ height: totalSize }}>
      {virtualRows.map(vr =>
        <VirtualRow top={vr.start}>
          <PinnedLeftCells />
          <ScrollableCells ref={rowMiddleRef} />  ← horizontal scroll source (or sync)
          <PinnedRightCells />
        </VirtualRow>
      )}
    </TotalHeightSpacer>
  </BodyContainer>
</DataGrid>
```

## Three-track layout primitive

The header and every row are each split into three horizontal zones:

- **Pinned-left zone** — `position: sticky; left: 0` relative to its scroll container.
- **Scrollable middle zone** — the only track that scrolls horizontally.
- **Pinned-right zone** — `position: sticky; right: 0`.

Width allocation:
- Pinned-left and pinned-right widths are the sum of their column widths (clamped to minWidth/maxWidth per column via sizing state).
- The middle zone is `flex: 1` with `min-width: 0` and `overflow-x: auto`.

Vertical vs horizontal scroll:
- Vertical scroll is owned by `BodyContainer`. Header does NOT scroll vertically.
- Horizontal scroll is owned by the body's middle-zone container (each `VirtualRow` shares the same parent scroller — NOT a per-row scroller).

### Avoiding per-row horizontal scrollers (important)

Do NOT put `overflow-x: auto` on each `VirtualRow`. That creates N independent scrollers that desync and destroy perf. Instead:

- The body has a single horizontal scroller wrapping the virtualized rows' middle-zone content.
- Inside that scroller, each virtual row's middle zone is `display: flex` with total width = sum of middle column widths, no internal scroll.
- Pinned-left and pinned-right zones live OUTSIDE the horizontal scroller (as siblings) so they don't move with `scrollLeft`.

Sketch:
```
<BodyContainer>                               vertical scroll
  <LeftRail>                                  sticky-left (zone 1)
    <VirtualizedRowsLeft />
  </LeftRail>
  <MiddleScroller>                            horizontal scroll (zone 2)
    <VirtualizedRowsMiddle />
  </MiddleScroller>
  <RightRail>                                 sticky-right (zone 3)
    <VirtualizedRowsRight />
  </RightRail>
</BodyContainer>
```

This means the virtualizer must coordinate three sub-trees that all render the same row indices at the same `top` offsets. They share one `rowVirtualizer` instance.

### Alternative: single-scroller with sticky columns

Some grids use one scroller and rely on `position: sticky; left: 0` for pinned columns. This is simpler but has a limitation: sticky cells are siblings of scrollable cells in the same flex row, which makes `z-index` stacking and shadows trickier. Known to work.

**Decision for v1: single-scroller with sticky columns.** Simpler. If we hit layout bugs with sticky + resize + virt, fall back to three-rail. Flag for confirmation.

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

## Horizontal scroll sync

Header must mirror body's `scrollLeft`:

```ts
const onBodyMiddleScroll = (e) => {
  if (headerMiddleRef.current) {
    headerMiddleRef.current.scrollLeft = e.currentTarget.scrollLeft
  }
}
```

- Body is the source of truth. Header is read-only receiver. No reverse sync.
- If header is scrollable by user (shouldn't be — `overflow-x: hidden`), disable the receive handler.
- Use `rAF` throttling only if profiling shows jank. Start without.

## Loading and empty states

| State | Render |
|---|---|
| `isLoading && data.length === 0` | Skeleton: 3 placeholder rows with shimmering cells. |
| `!isLoading && data.length === 0` | `emptyState` prop, or default "No results". |
| `isLoading && data.length > 0` | Keep current data; show a subtle 2px top-border "loading" bar. User is paginating while browsing. |

## Single-column sort — interaction with server

The grid calls `onSortingChange(next)`. The hook (`useProductsGrid`) translates this into a new BE request and resets `pageIndex` to 0. Sort state is persisted per-view (see `07_url_and_persistence.md`).

## Pagination controls

- The grid does NOT render a pagination footer. That's a page concern.
- The hook exposes `{ pageIndex, pageSize, total, setPage, setPageSize }` for the page to render its own footer.
- The grid receives `pagination` as a prop and calls `onPaginationChange` when a keyboard shortcut or some internal action changes it (currently none in phase 1).

## Open / TBD

- **Sticky vs three-rail layout.** I default to sticky columns in a single scroller. Need to prototype before committing, because sticky columns have known issues with `transform`-positioned virtualized rows (hardware acceleration can detach them). If it breaks, fall back to three-rail.
- **Header height configurable per column?** No in v1 — one global `headerHeight`.
- **Column groups / multi-level headers?** Out of scope.
- **Keyboard shortcut for "go to first/last page" inside the grid?** No — page footer owns that.
