# Refactor 1 — Consolidate transient state + split context

## Goal

Reduce the two structural smells in `src/components/DataGrid/` without changing the public API or the controlled-component contract:

1. Transition rules (what gets cleared on sort/filter/page/visibility change) are scattered across four `useDataGrid` setters and one `useEffect` in `DataGrid.tsx`.
2. `DataGridContext` bundles config, flags, handlers, and actions in one value — cells re-render on handler identity changes even when they only read `cellExtras`.

Non-goals: introducing Flux/Redux, owning `view` / `columnConfig` inside the grid, changing `useDataGrid`'s exported API, or replacing TanStack Table's state.

## Current state — what's moving

- `src/components/DataGrid/useDataGrid.ts:98-130` — `setPage`, `setPageSize`, `setSort`, `setFilters` each independently call `setCellRangeSelection(null)`; two of them also clear `rowSelection`.
- `src/components/DataGrid/DataGrid.tsx:346-370` — effect that clears `cellRangeSelection` when a column covered by the range becomes hidden. Lives in the view layer, calls back into caller-owned state.
- `src/components/DataGrid/DataGridContext.tsx` — one context carrying `cellExtras`, `featureFlags`, `cellMouseHandlers`, `toggleRow`. Consumed by `BodyCell` (needs `cellExtras` + `cellMouseHandlers`), `CheckboxCell` (needs `toggleRow`), and header components (need `featureFlags`).
- `src/components/DataGrid/useDataGrid.ts:240-306` — `gridProps` memo with ~20 deps. A side-effect of the scattered transient state, not itself a target — but it shrinks once (1) lands.

## Plan

### Step 1 — Introduce `useGridTransitions`

New file: `src/components/DataGrid/state/useGridTransitions.ts`.

Owns the three pieces of transient state the grid actually controls:

- `rowSelection: Record<string, boolean>`
- `cellRangeSelection: CellRangeSelection | null`
- `activeEditor: ActiveEditorState`

Implemented with `useReducer`. Action union:

```ts
type Action =
  | { type: "pageChanged" } // clears range
  | { type: "sortChanged" } // clears range + row selection
  | { type: "filtersChanged" } // clears range + row selection
  | {
      type: "visibilityChanged";
      visualColumnIds: string[];
      prevVisualColumnIds: string[];
    }
  | { type: "rowSelectionSet"; next: Record<string, boolean> }
  | { type: "rangeSet"; next: CellRangeSelection | null }
  | { type: "activeEditorSet"; next: ActiveEditorState };
```

Exports a hook returning `{ state, actions }` where `actions` are stable (dispatch-wrapped) callbacks. The visibility-reconciliation logic from `DataGrid.tsx:346-370` moves into the `visibilityChanged` reducer case, expressed as a pure function over previous-and-current `visualColumnIds` + current `cellRangeSelection`.

### Step 2 — Wire `useGridTransitions` into `useDataGrid`

`src/components/DataGrid/useDataGrid.ts`:

- Replace the three `useState` calls (lines 91-94) with `const { state, actions } = useGridTransitions()`.
- `setPage`, `setPageSize`, `setSort`, `setFilters` each call `onViewChange(...)` and then dispatch the matching action. The `setCellRangeSelection(null)` / `setRowSelection({})` calls are deleted — the reducer owns those invariants now.
- The `rowSelection` / `cellRangeSelection` / `activeEditor` fields in `gridProps` now read from `state`, their change handlers now call `actions.rowSelectionSet` / `actions.rangeSet` / `actions.activeEditorSet`.
- Public API (`gridProps`, `setPage`, `setPageSize`, `setSort`, `setFilters`, `selection`, `rangeSelection`) unchanged. Call sites do not move.

### Step 3 — Move visibility reconciliation into the reducer path

`src/components/DataGrid/DataGrid.tsx`:

- Delete the effect at lines 346-370 and the `lastVisualIdsRef` that supports it.
- In its place, a single effect that fires on `visualColumnIds` change and dispatches `visibilityChanged` with `{ visualColumnIds, prevVisualColumnIds }`. The reducer decides whether to clear the range.
- Caveat: this path only exists when the grid is wired via `useDataGrid`. If a consumer uses `<DataGrid />` standalone with their own `cellRangeSelection` state, they do not get auto-clear — same as today. Document this in `README.md` under the Selection section.

### Step 4 — Split `DataGridContext`

Split `src/components/DataGrid/DataGridContext.tsx` into two contexts in the same file (one module, two exports):

- `DataGridConfigContext` — `{ cellExtras, featureFlags }`. Rarely changes.
- `DataGridActionsContext` — `{ cellMouseHandlers, toggleRow }`. Changes on every grid render whose handler deps move.

Provider in `DataGrid.tsx` wraps both. Update consumers:

- `body/BodyCell.tsx` — reads `cellExtras` from config, `cellMouseHandlers` from actions.
- `cells/CheckboxCell.tsx` — reads `toggleRow` from actions.
- `header/*` — reads `featureFlags` from config.
- `useDataGridContext.ts` — replace with two small hooks (`useDataGridConfig`, `useDataGridActions`). Delete the single merged hook or keep it as a thin facade flagged `@deprecated` — prefer deleting since this is pre-release and there are no external consumers.

### Step 5 — Fold the 20-dep `gridProps` memo

After (1), `rowSelection` / `cellRangeSelection` / `activeEditor` references come from a stable `state` object and `actions` is stable. The memo dep list drops to ~8 entries (view fields, column config fields, feature flags). Keep the memo; it is still load-bearing for `<DataGrid />` render stability.

## Invariants to preserve (tests should assert)

- Transition table in `README.md:229-236` — every row becomes a reducer-level test.
- `useDataGrid`'s public surface: field-for-field equivalence before and after.
- `<DataGrid />` standalone (no `useDataGrid`) continues to work with fully controlled `rowSelection` / `cellRangeSelection` / `activeEditor` — the reducer is opt-in via `useDataGrid`, not baked into the component.
- Shift-click anchor behavior in `useRowSelection` is unchanged — that hook is orthogonal to this refactor and stays as-is.

## File-level change list

- Add `src/components/DataGrid/state/useGridTransitions.ts`
- Modify `src/components/DataGrid/useDataGrid.ts` — wire reducer, delete local `useState` + scattered clears
- Modify `src/components/DataGrid/DataGrid.tsx` — delete visibility-reconcile effect, replace with single dispatch effect, swap single-context provider for two providers
- Split `src/components/DataGrid/DataGridContext.tsx` into config + actions
- Replace `src/components/DataGrid/useDataGridContext.ts` with `useDataGridConfig` + `useDataGridActions`
- Touch consumers: `body/BodyCell.tsx`, `cells/CheckboxCell.tsx`, `header/HeaderCell.tsx`, `header/HeaderMenu.tsx`, `header/SortableHeaderCell.tsx`, `header/ResizeHandle.tsx`, `selection/useHeaderSelectionContext.ts` (only if it reads `featureFlags` — verify).
- Update `src/components/DataGrid/README.md` — note the standalone vs hook-wired auto-clear distinction.

## Risks / things to watch

- **Reducer action identity.** `actions.rangeSet` etc. must be stable across renders. Wrap each in `useCallback` over `dispatch` (dispatch is stable) — trivial but easy to forget.
- **Effect ordering.** `visibilityChanged` dispatch happens after a render where `visualColumnIds` changed. The render before the dispatch will still show the stale range for one frame. Today's effect has the same one-frame lag, so no regression — but do not "optimize" this into a `useLayoutEffect` without checking Safari `position: sticky` interactions.
- **Tests.** There are no existing tests for the transition rules today (worth verifying with a quick search before starting). Writing them _before_ the refactor gives a green-to-green migration signal. If the test harness isn't set up yet, this refactor is a reasonable forcing function for that — but treat it as scope, not a freebie.
- **Consumer churn.** Splitting the context touches ~6 files but each change is mechanical (swap one hook call for another). Low risk; do it in one commit so bisect stays clean.

## Out of scope (explicitly)

- Owning `view` / `columnConfig` inside the grid. Caller-owned on purpose for URL / localStorage / server persistence.
- Wrapping TanStack Table state.
- Replacing `useRowSelection` or `useCellRangeSelection` — they already encapsulate their own concerns and `useGridTransitions` only orchestrates cross-cutting clears.
- Introducing a serializable action log, middleware, or devtools hooks. If that ever becomes desirable, the reducer from (1) is the insertion point — but do not pre-build for it.

## Rough sequencing

1. Write reducer tests against the README transition table (red).
2. Land `useGridTransitions` + wire into `useDataGrid` (green on transition tests).
3. Move visibility reconciliation into the reducer path; delete the effect in `DataGrid.tsx`.
4. Split the context; update consumers.
5. Re-measure the `gridProps` dep list; tidy.

Each step is a reviewable commit. Steps 1-3 are one logical change (transitions); step 4 is independent and could ship separately if needed.
