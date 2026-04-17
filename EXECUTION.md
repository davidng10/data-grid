# EXECUTION

Session-by-session build plan for the DataGrid POC. This file exists because context resets between Claude sessions — each session must be self-briefable from files on disk, with no memory of prior chat.

## How to use this file

**At the start of every session:**

1. `PLAN.md` is loaded automatically via the index.
2. Read this file.
3. Jump to the section for the session you're starting.
4. Read the plan files in the session's **Read list**.
5. Read any source files the previous session produced to re-hydrate context (listed per-session).
6. Proceed with the **Build list**.

**At the end of every session:**

1. Verify every **Stopping criteria** checkbox is true.
2. Update the `Status` line at the top of the session's section (in-place edit).

## Testing policy

Claude does **not** run or screenshot the app, does **not** use browser automation, and does **not** make visual / performance / interaction claims. Verification is limited to:

- Static checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Grep-level checks for structural invariants (e.g. "no antd in `DataGrid.tsx`").
- Code inspection for logic that is stated in the plan (e.g. "`setSort` clears `rowSelection`").

All runtime / rendering / interaction verification is done by a human and lives under each session's **Manual QA** list. Do not promote a Manual QA item into Stopping criteria, and do not claim a Manual QA item passed.

## Session ordering

```text
Session 1: Foundation            [plans 01, 07, 08]
    ↓
Session 2: Presentation + virt    [plans 02, 03, 06]
    ↓
Session 3: Column features        [plan  04]
    ↓
Session 4: Selection + polish     [plans 05, 09]
```

No parallelism. Each session strictly depends on the previous one's completion.

---

## Session 1 — Foundation

**Status:** complete

**Read list** (in order):

- `PLAN.md`
- `plan/01_architecture.md`
- `plan/07_url_and_persistence.md`
- `plan/08_data_source_hook.md`

**Goal:** establish the type contract, the core state hook, the persistence helper, and a playground page that proves the hook works end-to-end without any presentation component yet.

**Build list:**

1. **Dependencies** — add to `package.json` and install:
   - `@tanstack/react-table`
   - `@tanstack/react-virtual`
   - `@dnd-kit/core`, `@dnd-kit/sortable`
   - `clsx`
   - (antd and its deps should already be present; if not, add now — needed for cell renderers in session 2)

2. **Types:** `src/components/DataGrid/DataGrid.types.ts`
   - `DataGridView<TFilters>`
   - `ColumnConfigState`
   - `DataGridColumnDef<TRow, TValue>` (with `cell`, `align`, `editable`, all `fixed*` flags — **no `type` field**)
   - `DataGridProps<TRow>` (full controlled prop surface — every feature, even ones not yet implemented; **no `cellRenderers` field**)
   - `DataGridCellProps<TRow, TValue>` (display + edit props + selection + `extras`, stable across phase 1 / phase 2)
   - `CellRenderer<TRow, TValue>` = `React.ComponentType<DataGridCellProps<TRow, TValue>>`
   - `CellRangeSelection`
   - `SortingState` (re-export from TanStack Table)
   - No `CellRendererRegistry` type — deleted.

3. **Core hook:** `src/hooks/useDataGrid.ts`
   - Contract per `plan/08_data_source_hook.md`
   - Internal `useState` for `rowSelection`, `cellRangeSelection`, `activeEditor`
   - Semantic setters encoding the transition rules table from plan 08
   - `gridProps` assembly
   - **No TanStack Table integration at this layer.** The hook is pure React state + setters. TanStack Table lives inside `<DataGrid />` (session 2). The hook's `gridProps` just forwards callbacks that will be wired in session 2.

4. **Persistence helper:** `src/hooks/useLocalStorageColumnConfig.ts`
   - Contract per `plan/07_url_and_persistence.md`
   - Read/write validation (max visible, fixed-visible enforcement, unknown-id drop)
   - `onWarn` DI, default `console.warn`
   - Schema version `:v1` in the key

5. **Playground page:** `src/pages/playground/PlaygroundPage.tsx`
   - Renders a **naive HTML `<table>`** using `data`, `columns`, `view.sorting`, `view.pageIndex`.
   - Buttons wired to `grid.setPage(+1)`, `grid.setPage(-1)`, `grid.setSort([{id:'name', desc:false}])`, `grid.setFilters(...)`.
   - `<select>` for `pageSize` → `grid.setPageSize(...)`.
   - Header checkbox for "select all visible" → calls `grid.gridProps.onRowSelectionChange`.
   - Display `JSON.stringify(grid.selection.rowIds)` in a corner.
   - Mock data: 500 rows of `{ id, name, age, status }`. In-memory sort + pagination helper.
   - This page's entire job in session 1 is: **prove the hook's state transitions work.** No layout, no virt, no features.

6. **Router wiring:** existing repo has `src/pages/`. Add route to `PlaygroundPage`, make it the default root if the current root is a stub.

**Stopping criteria (automated — Claude verifies; no browser / no runtime rendering):**

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` (or equivalent) passes with zero errors.
- [x] `pnpm build` passes.
- [x] `useDataGrid` returns a `gridProps` object matching the `DataGridProps<TRow>` contract (verify by type — the playground must successfully type-assign `grid.gridProps` to `DataGridProps<Row>`).
- [x] Transition rules encoded in `useDataGrid` setters (code review against plan 08):
  - `setSort` → resets `pageIndex` to 0 AND clears `rowSelection`.
  - `setFilters` → resets `pageIndex` to 0 AND clears `rowSelection`.
  - `setPageSize` → resets `pageIndex` to 0.
- [x] `useLocalStorageColumnConfig` uses a `:v1`-suffixed storage key and has read-side validation (max visible, fixed-visible enforcement, unknown-id drop) with an injectable `onWarn`.
- [x] Playground file imports `useDataGrid` and wires `grid.setPage`, `grid.setSort`, `grid.setFilters`, `grid.setPageSize`, and `grid.gridProps.onRowSelectionChange` (code inspection).

**Manual QA (human — out of scope for Claude's stopping criteria):**

- Playground renders 500 mock rows with working page nav.
- Clicking sort resets `pageIndex` to 0 and clears row selection live.
- Applying a filter resets `pageIndex` to 0 and clears row selection live.
- Changing page size resets `pageIndex` to 0.
- `useLocalStorageColumnConfig` persists across a hard refresh (set config, F5, config restored).

**Explicit non-goals in session 1:**

- `<DataGrid />` component (doesn't exist yet)
- TanStack Table integration
- Virtualization
- Any layout CSS beyond the playground's plain `<table>`
- Pinning / reorder / resize / visibility UI
- Selection UI (beyond a raw header checkbox)
- Cell range selection UI
- Cell renderers (use `{String(value)}` everywhere)
- Dev-mode unbounded-height warning
- README (content already exists in `plan/09_component_readme.md`; copy in session 4)

---

## Session 2 — Presentation + virtualization + cells

**Status:** complete

**Read list:**

- `PLAN.md`
- `plan/02_table_component.md`
- `plan/03_row_virtualization.md`
- `plan/06_cell_rendering.md`
- Skim: `plan/01_architecture.md` (for prop contract refresher), `plan/08_data_source_hook.md` (hook contract)

**Also at session start:**

- `git log --oneline -20` to confirm session 1 landed
- Read `src/components/DataGrid/DataGrid.types.ts` end-to-end (the type contract is the session's anchor)
- Read `src/hooks/useDataGrid.ts` to confirm `gridProps` shape

**Goal:** build `<DataGrid />` as a functioning virtualized table with sorting and cell rendering. No pinning, reorder, resize, selection, or column config UI yet.

**Build list:**

1. **Core component:** `src/components/DataGrid/DataGrid.tsx`
   - Adapter: `DataGridColumnDef[]` → TanStack `ColumnDef[]` (thin mapping layer)
   - `useReactTable` with all controlled state wired from `gridProps` (sorting, pagination, visibility, order, sizing, pinning, row selection — even the features we haven't built UI for yet, so the state plumbing exists)
   - `manualPagination: true`, `manualSorting: true`, `manualFiltering: true`
   - `useVirtualizer` for rows, `overscan: 10`, fixed row height from props
   - Single-scroll-container layout per plan 02: sticky header (`position: sticky; top: 0`), `VirtualSpacer` (`position: relative; height: totalSize; width: totalTableWidth`), absolute-positioned rows with **`top: Npx`** (not `transform` — see plan 02 rationale)
   - Dev-mode warning: `useEffect` on mount checks `clientHeight === scrollHeight && data.length > 50`, logs to console
   - `forwardRef` exposing `DataGridHandle = { scrollToRow, scrollToTop }`

2. **Context:** `src/components/DataGrid/internal/DataGridContext.tsx`
   - Per `01_architecture.md` State management section. One Context for **stable shared state only**: TanStack Table instance, `cellExtras`, resolved feature flags, `scrollMetricsRef`.
   - `const DataGridContext = React.createContext<DataGridContextValue<any> | null>(null)`
   - `useDataGridContext<TRow>()` hook with null-check for misuse
   - Memoize the provider value with `useMemo` keyed on identity-stable inputs so consumers don't churn
   - Used by `HeaderCell`, `BodyCell`, and cell components to read `cellExtras` and feature flags without prop drilling
   - **Do NOT put hot state (range selection, active editor, draft values) in this Context.** Plain React Context re-renders all consumers on any change — exactly what we want to avoid for hot state. Hot state stays as props + `React.memo`.

3. **Header:** `src/components/DataGrid/header/HeaderRow.tsx`, `HeaderCell.tsx`
   - Sticky via `position: sticky; top: 0; z-index: 2`
   - Click → single-column sort cycle (no sort → asc → desc → no sort), respecting `meta.sortable === false`
   - Sort indicator triangle inline with header label
   - `HeaderCell` reads feature flags from `useDataGridContext()` instead of receiving them via props
   - No 3-dots menu yet (session 3)
   - No resize handle yet (session 3)

4. **Body row + cell:** `src/components/DataGrid/body/VirtualRow.tsx`, `BodyCell.tsx`
   - `VirtualRow`: absolute positioned, `display: flex`, `width: totalTableWidth`
   - `BodyCell`: renders `column.cell ?? TextCell`, passes the full `DataGridCellProps` (display + edit-seam stubs + selection + `extras`). **No registry lookup** — just `column.cell ?? TextCell`. Phase 2 reuses the same code path; nothing changes here.
   - `BodyCell` reads `cellExtras` from `useDataGridContext()` and passes it to the cell component as the `extras` prop (Context for stable shared state, not for hot state)
   - `React.memo` on both with shallow comparators

5. **Cell renderer:** `src/components/DataGrid/cells/`
   - `TextCell.tsx` — the only built-in cell shipped in session 2. Renders `String(value ?? '')` with ellipsis + `title` attr + `align` styling. Also doubles as the fallback when a column has no `cell` set — there is no separate `DefaultCell`. Intentionally dumb: objects become `"[object Object]"`, arrays comma-join, dates become locale strings, etc. The ugliness is the signal to the developer to wire a proper cell.
   - **No other built-in cells in session 2.** `NumberCell`, `SingleSelectCell`, `MultiSelectCell`, `BooleanCell`, `DateCell`, `DateTimeCell` are deferred — the user will build them in a later pass. Consumers needing richer rendering in the meantime write their own inline `cell` on the column def.
   - **No registry file.** `TextCell` is a named export from `src/components/DataGrid/cells/index.ts`, re-exported from `src/components/DataGrid/index.ts` so consumers do `import { TextCell } from '@/components/DataGrid'`.
   - **Session 2 cells handle display only.** The `DataGridCellProps` contract includes edit props (`isEditing`, `draftValue`, `commitEdit`, `cancelEdit`), but `TextCell` ignores them — edit-mode branches are added in phase 2. Use `React.memo` with a shallow comparator on `value`, `align`, `isInRange`, `isEditing`.

6. **Styling:** `src/components/DataGrid/DataGrid.module.css`
   - Container, scroll container, header row, virtual row, cells
   - CSS variables for row height, header height, colors, borders
   - No Tailwind, no global styles

7. **Playground update:**
   - Replace the naive HTML `<table>` with `<DataGrid />`
   - Define a handful of mock columns exercising the cell behavior we have:
     - At least one column with `cell: TextCell` explicitly set
     - One column with NO `cell` set to verify the fallback (which is `TextCell`)
     - One column whose accessor returns an object `{ x: 1 }` to show the intentionally-ugly `"[object Object]"` coercion via `TextCell`
     - One column with an inline custom cell (e.g., `cell: ({ value }) => <a href="#">{String(value)}</a>`) to demonstrate the inline-custom pattern
     - One column with `align: 'right'` to verify the alignment hint works
   - Wrap the grid in the canonical flex pattern from `plan/09_component_readme.md` so sizing works
   - Keep external buttons for sanity

**Stopping criteria (automated — Claude verifies; no browser / no runtime rendering):**

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] Grep: no antd imports anywhere in `src/components/DataGrid/` (antd is not used in session 2 at all).
- [x] Grep: no `CellRendererRegistry`, `byKey`, `byType`, or `DefaultCell` symbols anywhere in `src/`.
- [x] `TextCell` is exported from `src/components/DataGrid/cells/index.ts` and re-exported from `src/components/DataGrid/index.ts` — and is the ONLY cell exported in session 2.
- [x] `BodyCell.tsx` uses `column.cell ?? TextCell` (code inspection — no registry lookup, no separate `DefaultCell`).
- [x] `DataGrid.tsx` calls `useReactTable` with `manualPagination: true`, `manualSorting: true`, `manualFiltering: true`, and forwards controlled state from `gridProps` for sorting, pagination, visibility, order, sizing, pinning, and row selection.
- [x] `DataGrid.tsx` uses `useVirtualizer` with `overscan: 10` and a fixed row height from props.
- [x] Virtual row positioning uses `top: Npx` (not `transform`) per plan 02 (grep `VirtualRow.tsx`).
- [x] Sticky header is implemented with `position: sticky; top: 0` in the CSS module (grep).
- [x] `DataGrid.tsx` contains a dev-mode `useEffect` that checks `clientHeight === scrollHeight && data.length > 50` and logs to console (code inspection).
- [x] `DataGrid` is a `forwardRef` exposing `DataGridHandle = { scrollToRow, scrollToTop }` (type check).
- [x] `useDataGridContext` hook exists with a null-check and is consumed by `HeaderCell` and `BodyCell`; hot state (range, editor, drafts) is NOT on the context (code inspection).
- [x] Playground defines at minimum: one column with `cell: TextCell` explicitly set, one column with no `cell` set (fallback), one column whose accessor returns an object (demonstrates the `"[object Object]"` coercion), one column with an inline-custom `cell`, and one column with `align: 'right'` (code inspection).

**Manual QA (human — out of scope for Claude's stopping criteria):**

- Grid renders 500 rows with row virt, smooth scroll at 60fps (Chrome DevTools Performance panel).
- Header click cycles through no-sort → asc → desc → no-sort.
- `TextCell` columns render plain strings with ellipsis overflow and title-attr tooltips on hover.
- The "no cell set" column visibly falls through to `TextCell`.
- The "accessor returns object" column visibly renders `"[object Object]"`.
- The inline-custom `cell` column renders as expected.
- `align: 'right'` visibly right-aligns the target column.
- Sticky header stays visible during vertical scroll.
- Dev-mode warning fires when the grid is wrapped in a `height: auto` container.

**Explicit non-goals in session 2:**

- Pinning (no sticky cell positioning yet — pinned cells render inline in session 2, get sticky positioning in session 3). `columnPinning` state is still wired through to TanStack Table so the plumbing exists; only the layout is deferred.
- Column reorder drag
- Column resize handles
- Column visibility modal
- Row selection checkbox column
- Cell range selection
- Additional built-in cell components (`NumberCell`, `SingleSelectCell`, `MultiSelectCell`, `BooleanCell`, `DateCell`, `DateTimeCell`) — deferred. The user will build these later. Only `TextCell` ships in session 2.
- **Scroll reset on page / sort / filter change.** `plan/03_row_virtualization.md` describes a rule that `bodyRef.scrollTop = 0` on these events. Deferred pending further discussion — the bidirectional coupling between the grid (scroll owner) and the hook (view state owner) needs more thought before implementing. Do NOT implement this in session 2.
- README (still in plan/ directory, copied in session 4)

---

## Session 3 — Column features

**Status:** complete

**Read list:**

- `PLAN.md`
- `plan/04_columns.md`
- Skim: `plan/02_table_component.md` (layout primitives — the pinning section specifically)

**Also at session start:**

- `git log --oneline -20`
- Read `src/components/DataGrid/DataGrid.tsx` end-to-end — the layout code is the primary integration surface for session 3
- Read `src/components/DataGrid/header/HeaderCell.tsx` — adding the menu button + resize handle here

**Goal:** add pinning, reorder, resize, and column visibility to `<DataGrid />`. All four ship together because they share layout primitives — splitting them forces context carryover.

**Build list:**

1. **Pinning layout:**
   - Compute `totalTableWidth`, `leftPinnedWidths`, `rightPinnedWidths`, per-column `leftOffset` / `rightOffset`
   - Apply `position: sticky; left: Npx` on pinned-left header + body cells
   - Apply `position: sticky; right: Npx` on pinned-right cells
   - Background color required on pinned cells so scrolled content doesn't bleed
   - Z-index: pinned header corners `3`, header row `2`, pinned body cells `1`, others default

2. **Horizontal scroll:** scroll container is already `overflow: auto` from session 2. Now each row has `width: totalTableWidth`, so horizontal scroll activates when total width exceeds viewport. Pinned cells stick via CSS. Verify the pinned-header-corner stays visible when scrolled both axes.

3. **Custom dropdown menu:** `src/components/DataGrid/internal/DropdownMenu.tsx`
   - Absolute-positioned `<ul>`, anchored to a trigger button
   - Click-outside via `useEffect` + `document.addEventListener('mousedown')`
   - Keyboard: `Escape` closes, `ArrowUp/Down` navigates, `Enter` activates
   - Items: `{ label, disabled?, disabledReason?, onClick }`
   - ~60 lines total. **No antd.**

4. **Header menu:** `src/components/DataGrid/header/HeaderMenu.tsx`
   - 3-dots icon button that appears on hover
   - Opens `DropdownMenu` with items: Pin Left / Pin Right / Unpin / Move Left / Move Right / Hide Column
   - Items disabled per `column.fixedPin` / `column.fixedPosition` / `column.fixedVisible`
   - `disabledReason` tooltip for each disabled item
   - Dispatches through TanStack Table mutators (which route back through `gridProps.onColumnXxxChange`)

5. **Reorder:** `src/components/DataGrid/dnd/ColumnReorderContext.tsx`
   - Three `SortableContext` instances, one per zone
   - Drag handle is the entire header cell (except the 3-dots button and resize handle — they stop propagation)
   - `fixedPosition` columns are rendered in the context but marked `disabled`
   - Custom collision detection skips fixed-position rects so neighbors can't land on them
   - Auto-scroll modifier enabled on the horizontal scroller
   - On drop: compute new order for the zone, update `columnOrder` (middle zone) or `columnPinning.left/right` (pinned zones)

6. **Resize handles:** `src/components/DataGrid/header/ResizeHandle.tsx`
   - 6px-wide absolute element on the right edge of each header cell
   - `cursor: col-resize`, `z-index: 1`
   - Wire to `header.getResizeHandler()` from TanStack Table
   - `columnResizeMode: 'onChange'` on the table instance
   - Min/max clamping in the column def (honored by the adapter)

7. **Column visibility:** the modal lives in the **playground**, not the grid framework.
   - Grid exposes state via `gridProps.onColumnVisibilityChange` — already wired from session 2
   - In the playground, add a "Columns" button + antd `Modal` with checkbox list
   - Max 40 enforcement in the modal's Apply handler (or rely on `useDataGrid`'s `maxVisibleColumns` enforcement — verify the warn callback fires)
   - Fixed-visible columns: checkbox disabled + checked

8. **Playground updates:**
   - Wire some columns as `fixedPin: 'left'` and `fixedPin: 'right'` to demonstrate fixed pinning
   - Wire one as `fixedVisible: true`
   - Wire one as `fixedPosition: true`
   - Connect playground's column config to `useLocalStorageColumnConfig`

**Stopping criteria (automated — Claude verifies; no browser / no runtime rendering):**

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] `DropdownMenu.tsx`, `HeaderMenu.tsx`, `ResizeHandle.tsx`, `ColumnReorderContext.tsx` exist and compile.
- [x] Grep: no antd imports in `DropdownMenu.tsx`.
- [x] `useReactTable` is configured with `columnResizeMode: 'onChange'` (code inspection).
- [x] `ResizeHandle` wires `header.getResizeHandler()` from TanStack Table; min/max clamping is honored in the `DataGridColumnDef` → TanStack `ColumnDef` adapter (code inspection).
- [x] `HeaderMenu` items for Pin Left / Pin Right / Unpin / Move Left / Move Right / Hide are conditionally disabled based on `column.fixedPin`, `column.fixedPosition`, and `column.fixedVisible`, with `disabledReason` strings attached (code inspection).
- [x] `ColumnReorderContext` uses three `SortableContext` instances (one per zone), marks `fixedPosition` columns `disabled`, and uses collision detection that skips fixed-position rects (code inspection).
- [x] Pinning layout computes `totalTableWidth`, `leftPinnedWidths`, `rightPinnedWidths`, and per-column `leftOffset` / `rightOffset`, applied via `position: sticky; left|right: Npx` with solid backgrounds and the z-index ladder from the plan (code inspection).
- [x] Column visibility modal in the playground calls through `gridProps.onColumnVisibilityChange`; max-40 enforcement is present either in the modal's Apply handler or via `useDataGrid`'s `maxVisibleColumns` warn callback (code inspection).
- [x] Playground wires `useLocalStorageColumnConfig` to the grid's column config state and declares at least one column each with `fixedPin: 'left'`, `fixedPin: 'right'`, `fixedVisible: true`, and `fixedPosition: true` (code inspection).

**Manual QA (human — out of scope for Claude's stopping criteria):**

- Pin/unpin via header menu works visually.
- Drag reorder works within each zone; cross-zone drag is blocked.
- Resize handles work, clamped to min/max.
- Column visibility modal enforces max 40 at runtime.
- Pinned columns stick correctly during horizontal scroll (pinned-left + header corner both sticky).
- `fixedPin` / `fixedPosition` / `fixedVisible` flags visibly disable the corresponding menu items / drag / checkbox.
- Column config persists across a hard refresh.
- Safari sanity check: sticky header + pinned columns still work in Safari.

---

## Session 4 — Selection + polish + README

**Status:** blocked on session 3

**Read list:**

- `PLAN.md`
- `plan/05_selection.md`
- `plan/09_component_readme.md`
- Skim: `plan/02_table_component.md` (loading/empty states)

**Also at session start:**

- `git log --oneline -20`
- `ls src/components/DataGrid/` to re-hydrate file layout
- Read `src/components/DataGrid/DataGrid.tsx` — selection wires into the same layout

**Build list:**

1. **Row selection:**
   - Inject a pinned-left checkbox column when `allowRowSelection: true`
     - id `__select__`, width 44, `fixedPin: 'left'`, `fixedVisible: true`, `fixedPosition: true`
   - Header checkbox with indeterminate state (all / none / some of current page selected)
   - Row checkbox cell (`CheckboxCell.tsx`)
   - Shift-click on a row checkbox selects range from last-clicked
   - Transition rules already in `useDataGrid`: preserved on page change, cleared on filter change — verify

2. **Cell range selection:**
   - Mouse: mousedown (start), mouseenter-while-dragging (extend), mouseup (end), click-outside (clear)
   - Shift-mousedown extends from existing anchor
   - Right-click: if inside range, keep range and fire `onRangeContextMenu(e, range)`; if outside, collapse to 1×1 and fire
   - Keyboard: arrow (move focus + collapse), shift+arrow (extend from anchor), Esc (clear), Ctrl+A (select all visible cells), Ctrl+C (fire `onRangeCopy` + write TSV to clipboard)
   - Default TSV serialization: tabs between cells, newlines between rows, multi-select joined with a comma and a space, null/undefined as empty, dates as ISO
   - **State management for range:** plain prop drilling + `React.memo` on cells. Do NOT reach for a `useSyncExternalStore` / Zustand-style store unless you've profiled and range-drag is the bottleneck. See `plan/01_architecture.md` State management section for the escape hatch if profiling demands it. Phase 1 ships with drilling.
   - Clear on page/sort/filter change (already in hook) and on column visibility change that removes a column inside the range
   - **Index-based math, not DOM-based.** `isInRange(rowIndex, columnId)` checks visual column position via `columnOrder` + pinning state

3. **Polish:**
   - Loading skeleton: 3 placeholder rows with a shimmer keyframe when `isLoading && data.length === 0`
   - Top-border "refetch" bar when `isLoading && data.length > 0` (2px, animated)
   - Empty state: renders `emptyState` prop, default "No results" centered in the body
   - Sticky scroll shadows: detect `scrollLeft > 0` → class on pinned-left edge showing a right-edge box-shadow; detect `scrollLeft < scrollWidth - clientWidth` → class on pinned-right edge showing left-edge box-shadow. Use a single scroll listener, toggle classes.

4. **README:** copy `plan/09_component_readme.md` content (everything under the first `---`) to `src/components/DataGrid/README.md`.
   - Add a top callout: **"Phase 1 — inline editing is NOT implemented. The `allowInlineEdit` flag, `activeEditor` state, and edit-mode cell rendering are stubbed but non-functional. Any references to phase 2 below are forward-looking."**
   - Gate each phase 2 reference with an inline `(phase 2 — not yet implemented)` tag. Grep `plan/09_component_readme.md` for `phase 2` and `activeEditor` to find them.
   - Verify the Quick Start snippet compiles against the actual types.

5. **Playground final updates:**
   - Demo row selection (header checkbox, individual row checkboxes)
   - Demo cell range selection (drag, shift+arrow, Esc)
   - Wire `onRangeContextMenu` to a native `alert` showing the cell count (stand-in for a real context menu)
   - Wire `onRangeCopy` to log the TSV to console
   - Add a "Show selection" button that displays current `grid.selection.rowIds` + range info

**Stopping criteria (automated — Claude verifies; no browser / no runtime rendering):**

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm build` passes.
- [ ] `CheckboxCell.tsx` exists; the grid injects a synthetic `__select__` column (id `__select__`, width 44, `fixedPin: 'left'`, `fixedVisible: true`, `fixedPosition: true`) when `allowRowSelection: true` (code inspection).
- [ ] Header checkbox computes an indeterminate state from current-page row selection (code inspection).
- [ ] Shift-click range logic on row checkboxes is present (last-clicked anchor + range extension).
- [ ] Cell range mouse handlers exist: mousedown (start), mouseenter-while-dragging (extend), mouseup (end), click-outside (clear), shift-mousedown (extend from anchor) (code inspection).
- [ ] Cell range right-click handler: if inside range, retain range and fire `onRangeContextMenu(e, range)`; if outside, collapse to 1×1 and fire (code inspection).
- [ ] Cell range keyboard handlers: arrow (move + collapse), shift+arrow (extend), Esc (clear), Ctrl+A (select all visible), Ctrl+C (fire `onRangeCopy` + write TSV) (code inspection).
- [ ] TSV serializer produces: tabs between cells, newlines between rows, multi-select joined with comma+space, null/undefined as empty string, dates as ISO.
- [ ] `isInRange(rowIndex, columnId)` uses index-based math against `columnOrder` + pinning state, not DOM queries (code inspection).
- [ ] Range state is cleared on page / sort / filter change (hook) and on visibility changes that remove a column inside the active range (component).
- [ ] `DataGrid.tsx` renders: a loading skeleton branch (`isLoading && data.length === 0`), a refetch bar branch (`isLoading && data.length > 0`), and an empty-state branch using the `emptyState` prop with a default.
- [ ] Sticky scroll shadow: a single scroll listener toggles CSS classes based on `scrollLeft` vs `scrollWidth - clientWidth` (code inspection).
- [ ] `src/components/DataGrid/README.md` exists; starts with a phase 1 callout stating inline editing is stubbed; every phase-2 reference is tagged `(phase 2 — not yet implemented)`.
- [ ] The README Quick Start snippet type-checks against the actual `DataGridProps` types (attempt to compile in-playground or via a throwaway `.tsx` snippet).
- [ ] Playground wires `onRangeContextMenu`, `onRangeCopy`, and a "Show selection" button (code inspection).

**Manual QA (human — out of scope for Claude's stopping criteria):**

- Pinned-left checkbox column appears when `allowRowSelection: true`.
- Header checkbox indeterminate state works visually.
- Shift-click on row checkboxes selects a range.
- Mouse drag creates a cell range.
- Arrow keys move focus; shift+arrow extends; Esc clears.
- Ctrl+C writes TSV to the clipboard (paste into a text editor to confirm).
- Right-click on a selected range fires `onRangeContextMenu` with the correct range.
- Right-click outside the range collapses to 1×1 and fires.
- Loading skeleton visible on initial load.
- Refetch bar visible when navigating pages.
- Empty state visible with `data.length === 0`.
- Sticky scroll shadows appear/disappear on horizontal scroll.

## If a session overruns

- **Do not** squeeze the final feature in with sloppy code to "finish the session."
- Body: list what's done, what's left, any in-progress decisions.
- Update the `Status` line in this file to `partial — Z pending`.
- Start the next session by finishing Z before touching anything else.
- Do not skip ahead to the next session's work while the current is partial.

## Porting to main codebase (post phase 1, not a Claude session)

1. Copy `src/components/DataGrid/` and `src/hooks/useDataGrid.ts`, `src/hooks/useLocalStorageColumnConfig.ts` into the main repo.
2. Adapt any path aliases, tsconfig references, module resolution, eslint config.
3. In the Products page of the main repo: wire the existing `useProductsUrlView` + `useProductsQuery` + `buildProductColumns` (per plan 08 integration example A) to `useDataGrid`.
4. QA against the real Products data: 1000 attributes, 100 rows per page, real filter shapes including 1000-element `$in` arrays, the existing `filterView=xxx&skuId=...` URL reconciliation.
5. Run the Safari sanity check on sticky header + pinned columns one more time in the integrated environment.
