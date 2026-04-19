# DataGrid

A generic, virtualized, fully-controlled data grid component for React + TypeScript.

> **Phase 1 — inline editing is NOT implemented.** The `allowInlineEdit` flag, `activeEditor` state, and edit-mode cell rendering are stubbed but non-functional. Any references to phase 2 below are forward-looking.

## Quick start

```tsx
import { useState } from "react";
import { DataGrid, TextCell, defaultRangeToTSV } from "@/components/DataGrid";
import { useDataGrid } from "@/hooks/useDataGrid";
import { useLocalStorageColumnConfig } from "@/hooks/useLocalStorageColumnConfig";
import { useQuery } from "@tanstack/react-query";

import type { DataGridColumnDef, DataGridView } from "@/components/DataGrid";

type Row = { id: string; name: string; price: number; createdAt: string };

const columns: DataGridColumnDef<Row>[] = [
  { id: "id", header: "ID", accessor: (r) => r.id, cell: TextCell },
  { id: "name", header: "Name", accessor: (r) => r.name, cell: TextCell },
  {
    id: "price",
    header: "Price",
    accessor: (r) => r.price,
    cell: TextCell,
    align: "right",
  },
  {
    id: "createdAt",
    header: "Created",
    accessor: (r) => r.createdAt,
    cell: TextCell,
  },
];

function MyPage() {
  const [view, setView] = useState<DataGridView<object>>({
    pageIndex: 0,
    pageSize: 50,
    sorting: [],
    filters: {},
  });
  const [columnConfig, setColumnConfig] =
    useLocalStorageColumnConfig("my-grid-v1");

  const { data, isLoading } = useQuery({
    queryKey: ["rows", view],
    queryFn: () => fetchRows(view),
  });

  const grid = useDataGrid<Row, object>({
    view,
    onViewChange: setView,
    columnConfig,
    onColumnConfigChange: setColumnConfig,
    rowCount: data?.total ?? 0,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <TopBar style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          {...grid.gridProps}
          data={data?.items ?? []}
          isLoading={isLoading}
          getRowId={(r) => r.id}
          columns={columns}
          // Opt-in to copy: grid only writes to clipboard if you provide this.
          onRangeCopy={(range, ctx) =>
            defaultRangeToTSV(range, ctx.getCellValue, ctx.columns)
          }
        />
      </div>
    </div>
  );
}
```

Note: cells live **inline on each column** via `column.cell`. There is no `cellRenderers` prop on `<DataGrid />` — import the cell component you want and pass it directly. See the Cell rendering section below.

## Sizing — read this before anything else

The grid fills its container. **You are responsible for giving it a bounded parent.** `<DataGrid />` renders as `display: flex; flex-direction: column; width: 100%; height: 100%`. There are no `width` or `height` props.

### What "bounded" means

The parent's height must be computable by the browser's layout engine at render time. That can be:

- A viewport unit (`100vh`, `100dvh`, `100svh`)
- A flex result (`flex: 1` inside a column flex chain that terminates in a bounded ancestor)
- A container query result
- A fixed pixel value (`height: 600px`)
- A `calc()` of any of the above

It **cannot** be `height: auto` at the scroll owner or anywhere between it and the bounded ancestor. `auto` means "as tall as my content," which for a virtualized grid is effectively infinite — the virtualizer thinks it has unlimited space and renders every row.

### `100vh` vs `height: 100%` — use both, at different levels

`100vh` and `height: 100%` are not alternatives. `100vh` is the terminating anchor _somewhere_ up the tree (usually at the app shell's outermost container). `height: 100%` is the propagation mechanism below it. Between them can be any amount of flex math.

```tsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>  {/* ← bound anchored here */}
  <TopBar          style={{ flexShrink: 0 }} />
  <PageTitle       style={{ flexShrink: 0 }} />
  <ExpandableFilter style={{ flexShrink: 0 }} />  {/* height animates freely */}
  <div style={{ flex: 1, minHeight: 0 }}>         {/* grid's parent — flex math */}
    <DataGrid ... />                              {/* height: 100% of the flex-1 div */}
  </div>
</div>
```

When the filter expands:

1. Filter's height changes
2. Browser re-runs flex layout on the outer column
3. The `flex: 1` div shrinks to absorb the filter's growth
4. The grid's scroll container's `clientHeight` drops
5. TanStack Virtual's internal `ResizeObserver` fires
6. Visible row count recalculates, re-renders

All automatic. No JS from you.

### Pattern: fixed-height container (drawer, modal, widget)

For bounded-but-not-viewport contexts:

```tsx
<div style={{ height: 600 }}>
  <DataGrid ... />
</div>

// Or inside an antd Drawer
<Drawer bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
  <DataGrid ... />
</Drawer>
```

Works fine. Won't track viewport changes, which is usually the right call for a widget.

## Integration gotchas — these bite everyone once

### 1. Forgetting `minHeight: 0` on flex children

Flex children default to `min-height: auto`, meaning "don't shrink below my intrinsic content size." A tall virtualized grid inside a `flex: 1` div with default `min-height` refuses to shrink, the parent grows to fit, and instead of the grid scrolling internally you get a giant **page-level** scrollbar. Your header / top bar stays visible but the grid takes over the whole viewport and then some.

**Fix:** every `flex: 1` (or any flex child) between your viewport-bound ancestor and the grid must have `minHeight: 0`. No exceptions.

### 2. `height: auto` anywhere above the grid

Somewhere in the chain, `height: auto` sneaks in — an unstyled wrapper `<div>`, a route container that forgot to propagate height, a `<Fragment>` that can't propagate. The grid's scroll container's `clientHeight` becomes unbounded. TanStack Virtual sees infinite space and renders every row at once. Perf dies.

**Fix:** trace the full chain from the viewport-bound ancestor down to the grid. Every link must propagate height (either via `flex: 1 + minHeight: 0` or explicit `height: 100%` or a fixed value).

**Dev-mode warning:** on mount, if `scrollContainer.clientHeight === scrollContainer.scrollHeight && data.length > 50`, the grid logs a warning pointing at this README section. Don't ignore it.

### 3. Missing `flexShrink: 0` on siblings above the grid

In the canonical pattern, every sibling of the grid's parent (TopBar, PageTitle, ExpandableFilter) needs `flexShrink: 0`. Without it, when the grid wants more space, the flex algorithm will _compress_ your header / filter to make room, causing visible jitter and weird partial-collapse.

**Fix:** `flexShrink: 0` on anything above the grid that should be sized by content and never squeezed. The grid's parent is the only thing that should flex.

### 4. Page-level scroll does NOT mix with a full-height grid

If your layout is designed for page-level vertical scroll (the user scrolls the whole document), you cannot use `flex: 1 + height: 100%` for the grid. There is no bounded ancestor for `100%` to resolve against — the outer container is `min-height: 100vh` not `height: 100vh`, and its height grows with content.

**Options:**

- Use a fixed-height container: `<div style={{ height: 600 }}>`. Won't track viewport, but works inside a scrolling page.
- Redesign the layout as a full-height app shell. Preferred for real grids — page-level scroll conflicts with in-grid scroll UX anyway (where does the wheel event go?).

You can't have both. Pick one per page at design time.

### 5. Browser zoom and DPI changes

Browser zoom (Ctrl+ / Ctrl-) changes the effective viewport size. This triggers the same flex re-layout path as a window resize, so it's automatic — IF your chain is viewport-relative or flex-derived. Fixed-pixel sizing is opt-in to not-being-responsive; that's usually fine for widgets but wrong for full-page layouts.

### 6. Filter animations and resize storms

When the filter (or any sibling above the grid) animates its height, `ResizeObserver` fires continuously during the animation. TanStack Virtual is cheap to recompute, so this is fine in practice. If you see jank, animate `max-height` on the filter (predictable curve) rather than measured-height.

### 7. Safari + `position: sticky` + `transform`

The grid's sticky header and pinned columns rely on `position: sticky`. A transformed ancestor (any element with `transform: translate...`) breaks sticky in Safari — the sticky elements silently fail to pin.

**What this means for you:** if you wrap the grid in something that uses `transform` (certain animation libraries, some layout utilities), the header won't stick in Safari.

**Internal note:** the grid itself positions virtual rows with `top: Npx` instead of `transform: translate3d(0, Npx, 0)` specifically to avoid this. Don't "optimize" that later without testing Safari.

## Core concepts

### `<DataGrid />` is presentation only

Handles virtualization, layout, pinned columns, cell rendering, selection interactions, drag/resize/reorder UIs. Does NOT handle data fetching, URL state, persistence, filter UI, or column def construction. Those are your problem.

### `useDataGrid` is the state layer

Owns transition rules (sort/filter → reset page + clear row selection; all view changes → clear cell range), transient state (row/range selection, active editor _(phase 2 — not yet implemented)_), and assembles `gridProps` for you. You provide `view` + `columnConfig` as controlled state; the hook calls your change handlers.

### `useLocalStorageColumnConfig` is the only shipped persistence helper

Persists column visibility/order/sizing/pinning to localStorage under a key you name. URL state is explicitly NOT a grid concern — write your own page-level hook.

## Feature flags

Passed via `useDataGrid` options, propagated to `<DataGrid />`:

| Flag                    | Default   | When false                                                                                            |
| ----------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `allowSorting`          | true      | Header clicks don't sort.                                                                             |
| `allowPinning`          | true      | No pin/unpin in header menu. Column-def `fixedPin` still honored.                                     |
| `allowReorder`          | true      | No drag; no "move" in header menu.                                                                    |
| `allowResize`           | true      | No resize handles.                                                                                    |
| `allowColumnVisibility` | true      | "Hide" not offered in header menu.                                                                    |
| `allowRowSelection`     | true      | No pinned-left checkbox column.                                                                       |
| `allowRangeSelection`   | true      | Mouse drag doesn't start a range.                                                                     |
| `allowInlineEdit`       | **false** | Cells never enter edit mode. _(Phase 2 — not yet implemented; flipping the flag does nothing today.)_ |

## Transition rules (live in `useDataGrid`)

| Event                         | pageIndex | rowSelection | cellRangeSelection                     |
| ----------------------------- | --------- | ------------ | -------------------------------------- |
| `grid.setPage(i)`             | → i       | preserved    | cleared                                |
| `grid.setPageSize(n)`         | → 0       | preserved    | cleared                                |
| `grid.setSort(s)`             | → 0       | **cleared**  | cleared                                |
| `grid.setFilters(f)`          | → 0       | **cleared**  | cleared                                |
| column visibility change      | unchanged | preserved    | cleared if range spans a hidden column |
| column reorder / resize / pin | unchanged | preserved    | preserved                              |

Non-negotiable inside the hook. If your page needs different semantics, wrap the hook.

## Cell rendering

The grid has **no cell type enum** and **no cell registry**. Every column declares its cell component directly on the column def:

```ts
{ id: 'price', header: 'Price', accessor: (r) => r.price, cell: TextCell, align: 'right' }
```

If you omit `cell`, the grid falls back to `TextCell` which renders `String(value ?? '')`. For anything non-string — arrays, objects, dates — that output is intentionally ugly as a signal to write a custom `cell`.

### Built-in cells (import and use)

Phase 1 ships:

```ts
import { CheckboxCell, TextCell } from "@/components/DataGrid";
```

- `TextCell` — display-only, uses `String(value ?? '')`, respects `align`. Doubles as the implicit fallback when `column.cell` is unset; there is no separate `DefaultCell`.
- `CheckboxCell` — used by the grid internally for the injected `__select__` row-selection column. You can also use it directly if you build a custom selection model.

Richer built-ins (`NumberCell`, `SingleSelectCell`, `MultiSelectCell`, `BooleanCell`, `DateCell`, `DateTimeCell`, etc.) are **deferred future work**. Until they land, write a custom cell inline on the column for anything fancier than plain-text coercion.

### Custom cells — inline on the column

```tsx
const SkuLinkCell: CellRenderer<Product, string> = ({ value, extras }) => (
  <a onClick={() => (extras.onProductClick as any)?.(value)}>{value}</a>
)

const columns: DataGridColumnDef<Product>[] = [
  { id: 'sku.id', header: 'SKU', accessor: (p) => p.skuId, cell: SkuLinkCell, fixedPin: true, pin: 'left' },
  // ...
]

<DataGrid ... columns={columns} cellExtras={{ onProductClick }} />
```

`cellExtras` is a passthrough — anything you put there is available on every cell's `extras` prop. Useful for handlers, formatters, app-level context, etc.

## Selection & Copy

Two independent selection systems:

### Row selection

When `allowRowSelection` is true (the default), the grid injects a pinned-left checkbox column (`id: '__select__'`). The header checkbox is tri-state (`all` / `some` / `none` for the current page). Shift-click on a row checkbox toggles a range from the last-clicked anchor.

State shape: `Record<string, boolean>` keyed by `getRowId(row)`. Read with `grid.selection.rowIds` from `useDataGrid`.

### Cell range selection

When `allowRangeSelection` is true, dragging across cells builds a rectangular selection (`{ anchor, focus }` with `{ rowIndex, columnId }` endpoints). Keyboard:

- Arrow keys move focus by one cell (only when a cell is focused)
- Shift + arrow extends focus from the anchor
- Esc clears the range (focus stays)
- Ctrl/Cmd + A selects every visible cell on the current page
- Ctrl/Cmd + C fires `onRangeCopy` (see below)

**Focused cell is cleared on page / sort / filter change.** When no cell is focused, the grid does NOT intercept arrow keys — they flow to the browser as native page scroll. Click any cell to re-engage cell traversal.

### Copy API (`onRangeCopy`)

The grid does **not** ship a built-in clipboard default. Ctrl+C inside the grid is a no-op unless you provide `onRangeCopy`:

```tsx
import { defaultRangeToTSV } from "@/components/DataGrid";

<DataGrid
  onRangeCopy={(range, { getCellValue, columns }) =>
    defaultRangeToTSV(range, getCellValue, columns)
  }
/>;
```

- The callback receives the active range plus a `getCellValue(rowIndex, columnId)` resolver and the visible-columns slice the range covers (in visual order, left → right).
- Return a `string` and the grid writes it to the clipboard via `navigator.clipboard.writeText`.
- Return `null` / `undefined` / `void` and the grid writes nothing — useful if you wrote to the clipboard yourself or chose to drop the event.

The exported `defaultRangeToTSV` is a pure helper. For schemas where the raw accessor output doesn't serialize well (chips, dates rendered as relative time, badge cells), write your own — the grid never assumes.

### Right-click (`onRangeContextMenu`)

```tsx
<DataGrid
  onRangeContextMenu={(e, range) => openMyMenu(e.clientX, e.clientY, range)}
/>
```

If the click lands inside the current range, the range is preserved and the callback fires with that range. If it lands outside, the grid collapses to a 1×1 range on that cell first, then fires. The grid does **not** render a menu — that's your job. Items like "Copy", "Bulk edit", "Export" are application-specific.

## API surface

See `DataGrid.types.ts` for the full contract. Key types:

- `DataGridProps<TRow>` — component controlled props (no `cellRenderers` field)
- `DataGridColumnDef<TRow, TValue>` — column definition (`id`, `header`, `accessor`, `cell`, `align`, `editable` _(phase 2 — not yet implemented)_, `width`, pinning/visibility flags)
- `CellRenderer<TRow, TValue>` — `React.ComponentType<DataGridCellProps<TRow, TValue>>`
- `DataGridCellProps<TRow, TValue>` — everything a cell receives: display props + edit props _(phase 2 — not yet implemented)_ + selection props + `extras`
- `DataGridView<TFilters>` — view state object: `{ pageIndex, pageSize, sorting, filters }`
- `ColumnConfigState` — column visibility/order/sizing/pinning bundle
- `CellRangeSelection` — `{ anchor, focus }` with `{ rowIndex, columnId }` endpoints
- `RangeCopyContext<TRow>` — `{ getCellValue, columns }` passed to `onRangeCopy`

## Performance notes

- **Fixed row height** (default 40px). Dynamic measurement not supported.
- **Row virtualization** via TanStack Virtual v3, `overscan: 10`.
- **No column virtualization.** Designed for ≤40 visible columns in practice.
- **Cell range selection** re-renders affected cells on every mouse-move during a drag. Fine at 4000 cells (100 × 40); per-cell `React.memo` short-circuits the cells outside the changing perimeter. Optimize with a store-based subscription if you push past that.
- **Don't use `transform` for row positioning** — breaks Safari `position: sticky`. Use `top` + `position: absolute`.

## What this component does NOT do

- Infinite scroll (use server-side pagination)
- Dynamic row heights (truncate with tooltip instead)
- Column virtualization
- Multi-column sort
- Inline editing _(phase 2 — not yet implemented; cells render display-only today)_
- Cross-user URL sharing
- Filter UI (external to the grid)
- Data fetching, caching, optimistic updates
- Built-in clipboard format (you provide `onRangeCopy`; `defaultRangeToTSV` is an opt-in helper)

## FAQ / Troubleshooting

**Q: All my rows render at once and perf is dead.**
A: Gotcha 2. Your chain has `height: auto` somewhere. Trace from a viewport-bound ancestor.

**Q: My page has a giant document-level scrollbar and the grid doesn't scroll internally.**
A: Gotcha 1 or 4. Missing `minHeight: 0` on a flex child, or you've mixed full-height-grid with page-level scroll.

**Q: The grid shrinks when it should stay put; my header squishes.**
A: Gotcha 3. Missing `flexShrink: 0` on siblings above the grid.

**Q: The sticky header / pinned columns don't pin in Safari.**
A: Gotcha 7. Some ancestor has `transform`, which breaks sticky. Remove it or move the grid out of the transformed subtree.

**Q: The filter animation causes the grid to jitter during expand.**
A: Expected — `ResizeObserver` is firing many times during the animation. Usually fine. If bad, animate `max-height` not measured height.

**Q: How do I add a custom cell renderer for one specific column?**
A: Set `cell: MyCustomCell` directly on that column's `DataGridColumnDef`. There is no registry — the component reference lives inline on the column.

**Q: My column shows `[object Object]` in every cell.**
A: Your `accessor` returns an object. Either change the accessor to return a primitive (`(row) => row.nested.value`) or pass a custom `cell` that knows how to render the object shape. The default cell is intentionally dumb about objects.

**Q: I want an editable text column but my custom cell doesn't respond to double-click.**
A: Inline editing is not implemented in phase 1 — `allowInlineEdit` is false and the `isEditing` seam exists but is dormant. _(Phase 2 — not yet implemented.)_ Until then, setting `editable: true` does nothing visible.

**Q: How do I persist view state across refreshes?**
A: The grid doesn't do it. Write a page-level hook that reads from URL / localStorage / server and passes `[view, setView]` to `useDataGrid`. The existing Products page is the reference.

**Q: How do I get all selected row ids?**
A: `grid.selection.rowIds` — a `string[]` derived from the internal `rowSelection` map. `grid.selection.clear()` resets it.

**Q: Ctrl+C does nothing inside the grid.**
A: You haven't wired `onRangeCopy`. The grid intentionally ships no built-in clipboard default — see the Copy API section. Wire `defaultRangeToTSV` for the spreadsheet-flavored default, or write your own for richer schemas.

**Q: Arrow keys scroll the page instead of moving between cells.**
A: No cell is focused. The grid only intercepts arrow keys when a cell is focused (after a click or a range drag). After page navigation, focus clears and arrow keys revert to native browser scroll. Click any cell to re-engage cell traversal.

**Q: The grid flashes empty on page change.**
A: Your fetch layer isn't keeping previous data. TanStack Query: set `placeholderData: keepPreviousData`. Otherwise: manually preserve `data` until the next result arrives.
