# Data Grid — Master Plan

## Goal
Build a generic, data-source-agnostic `<DataGrid />` for React + TypeScript, plus an opinionated hook that wires it to the supplier-facing Products × Attributes screen.

## Non-negotiables (confirmed)
- React + TypeScript
- TanStack Table v8 (headless) + TanStack Virtual v3 (row virt only)
- No Tailwind. CSS Modules + inline styles, merged with `clsx`
- Antd allowed inside cell renderers; not inside the grid framework
- Data-source agnostic. Grid takes `data` + controlled state + callbacks. Hooks wire it to BE/URL.
- Phase 1 is display-only; phase 2 adds inline editing. Architecture leaves a seam for it.

## Architecture in one breath

```
 Page owns: BE fetch, URL state, filter storage, reconciliation, column defs, renderers
                          │
                          ▼   (controlled: view + columnConfig, callbacks for changes)
                    useDataGrid             ← headless: state transitions + gridProps assembly
                          │
                          ▼
                    <DataGrid />            ← presentation: virt, layout, selection, cell renderers
```

Three layers:

1. **`<DataGrid />`** — generic presentation component. Props-in, callbacks-out. Handles virtualization, three-zone layout (pinned left / scrollable middle / pinned right), horizontal scroll, cell rendering via the registry, selection interactions, drag/resize/reorder UIs. Knows nothing about BE, URL, persistence, or state transition rules.
2. **`useDataGrid`** — headless state hook. Takes `view` + `columnConfig` as controlled external state, plus `rowCount` and feature flags. Owns transition rules (sort/filter → reset page + clear selection; page-size → reset page; etc.), owns transient state (row/range selection, active editor), assembles `gridProps` to spread onto `<DataGrid />`. Exposes semantic setters (`setPage`, `setPageSize`, `setSort`, `setFilters`). Knows nothing about persistence, BE, columns, or renderers.
3. **Page code** — owns everything external: data fetching, URL wire format (the team's existing `useProductsUrlView` logic, unchanged), filter state storage and reconciliation, column def construction, cell renderer wiring. Optionally uses `useLocalStorageColumnConfig` for the universal column-config-in-localStorage pattern.

## Key decisions baked in (push back if wrong)

1. **Fixed row height v1.** Default 40px, configurable. Dynamic measurement is out of scope. Cells truncate with tooltip-on-hover. Rationale: dynamic height + pinned columns + resize is a known jank source. Revisit v2 if required.
2. **Edit-during-scroll commits on unmount.** When the active editor scrolls out of the virtualization window, we preserve its `draftValue` in state above the virtualizer so it survives remount; on a different-row focus we commit (Excel behavior). Esc cancels.
3. **URL and view persistence are the page's concern, not the hook's.** `useDataGrid` is fully controlled on `view` + `columnConfig`. The page provides whatever URL / localStorage / server-side strategy it wants — including the existing production URL reconciliation logic untouched. One optional peer hook ships for the universal case: `useLocalStorageColumnConfig(tableInstanceId)`. No URL helpers in v1. Rationale: real-world tables mix opaque ids, raw params, and reconciliation rules that differ per page; baking one strategy into the hook locks consumers out.
4. **Rectangular (contiguous) cell range selection only.** No ctrl-click multi-range. State is `{ anchor, focus }` with `{ rowIndex, columnId }` endpoints.
5. **Column config persistence** (when used) is per `tableInstanceId` via the optional `useLocalStorageColumnConfig` helper. Key `datagrid:config:<instanceId>:v1`. Each consumer names their grid. Opting out is trivial — pass `useState` instead.
6. **Max 40 visible columns** enforced in the column config modal. On load, if persisted state exceeds 40, trim with a one-time toast.
7. **DnD library: @dnd-kit** (smaller, modern, good with sticky/virt).
8. **Cell renderer resolution:** `fixedKeyRegistry[column.id] ?? typeRegistry[column.type] ?? DefaultCell`. Cells receive a stable `DataGridCellProps` contract including the editing-mode seam.
9. **Three-track layout:** `[pinnedLeft][scrollableMiddle][pinnedRight]`. Only the middle track scrolls horizontally. Reorder and DnD are scoped within each zone (user cannot drag between zones — use the column header menu to change pin state instead).
10. **Data fetching is the page's concern.** TanStack Query is recommended (for `keepPreviousData` + future caching), but `useDataGrid` has no dependency on it.
11. **Transition rules encoded in the hook's semantic setters:**
    - `setSort(s)` → resets `pageIndex` to 0, clears row selection, clears range selection
    - `setFilters(f)` → resets `pageIndex` to 0, clears row selection, clears range selection
    - `setPageSize(n)` → resets `pageIndex` to 0, clears range selection
    - `setPage(i)` → clears range selection only
    Non-negotiable inside the hook. Pages with different semantics wrap the hook — but then they're off the happy path.

## Scope by phase

**Phase 1 — Display-only grid (this plan).**
Render, row virtualize, sort (single col, server), paginate (controlled), pin (custom + fixed), reorder (within zone), resize, column visibility + config modal, row selection (pinned-left checkbox column), cell range selection (state + right-click callback), URL + localStorage persistence, `useProductsGrid` wiring.

**Phase 2 — Inline editing (separate plan later).**
Per-type editor components, commit/cancel wiring to a BE mutation, optimistic updates, error recovery, keyboard navigation between cells. Additive — the contract is already in phase 1.

**Explicitly out of scope (deferred or excluded).**
- Infinite scroll / keyset pagination (offset is accepted)
- Cross-user URL sharing (local-first only)
- RTF inline editing
- Multi-column sort
- Dynamic row height
- Saved views / server-side view persistence
- Filter UI (lives outside the grid)
- BE caching, request dedup, optimistic fetching
- Column virtualization

## Risks to acknowledge

- **Virtualization + pinned columns + resize + reorder** is 60–80% of the build effort. Looks simple on paper. Budget accordingly.
- **Range selection indices shift** when sort/filter/page changes. I default to clearing the range on those events — call out if this is wrong for your UX.
- **localStorage accumulation.** Months of use without eviction will grow. Plan: LRU cap at 50 entries per `tableInstanceId`, cleaned on write.
- **Column config schema evolution.** Use a versioned key. Validate on read. Don't crash on unknown columns.

## Sub-plans

Each file in `plan/` covers one slice. Read in order on first pass; edit independently.

1. [`plan/01_architecture.md`](./plan/01_architecture.md) — component boundaries, prop contract, feature flags, column def shape
2. [`plan/02_table_component.md`](./plan/02_table_component.md) — `<DataGrid />` shell, TanStack Table wiring, three-track layout, sort, horizontal scroll sync
3. [`plan/03_row_virtualization.md`](./plan/03_row_virtualization.md) — TanStack Virtual setup, fixed height, overscan, edit-during-scroll contract
4. [`plan/04_columns.md`](./plan/04_columns.md) — pinning (custom + fixed), reorder within zones, resize with min/max, column visibility modal
5. [`plan/05_selection.md`](./plan/05_selection.md) — row selection (pinned-left checkbox) + cell range selection + right-click callback API
6. [`plan/06_cell_rendering.md`](./plan/06_cell_rendering.md) — fixed-key + type registries, cell props contract, inline edit seam
7. [`plan/07_url_and_persistence.md`](./plan/07_url_and_persistence.md) — persistence guidance + the optional `useLocalStorageColumnConfig` helper; explicit rationale for why URL state is NOT a grid concern
8. [`plan/08_data_source_hook.md`](./plan/08_data_source_hook.md) — `useDataGrid` contract, transition rules, gridProps assembly, three integration examples (Products / Orders / drawer)

## Open questions I'd still like answered

1. **Row resize limits.** Default: `minWidth: 60`, `maxWidth: 800`. OK?
2. **Default row height.** 40px fixed. OK?
3. **Column visibility × range clear.** If a range spans a column the user hides, clear the range (vs skip the hidden column). I default to clear. OK?
4. **`activeEditor` internal vs external.** Internal to `useDataGrid` in phase 1. Lifted to controlled only if phase 2 needs it. OK?
5. **Warn channel.** `onWarn` is dependency-injected (defaults to `console.warn`). Caller wires it to their toast system. OK?
