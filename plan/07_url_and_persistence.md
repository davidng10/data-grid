# 07 — Persistence

## Scope shift from earlier drafts

Earlier drafts had the grid hook owning URL state, history semantics, opaque-id minting, eviction, and bootstrap. **That is no longer the case.** All URL and view persistence is the page's concern. `useDataGrid` is fully controlled on `view` and `columnConfig` — it calls `onViewChange` / `onColumnConfigChange` when the user acts; the page writes state to wherever it wants (URL, localStorage, memory, Redux, server).

Rationale: real-world tables need arbitrary URL shapes (mix of opaque id + raw params + reconciliation). The Products page's existing production logic already handles `filterView=xxx&page=12&pageSize=100&skuId=123` with a reconciliation rule where `filterView` overrides raw params. Baking one strategy into the hook locks consumers out of their own conventions. Externalizing costs some page-level boilerplate but wins flexibility.

## What ships in v1

One optional peer hook for the universally-useful case: **column config persistence to localStorage**. That's it. No URL helpers.

### `useLocalStorageColumnConfig`

```ts
function useLocalStorageColumnConfig(
  tableInstanceId: string,
  options?: {
    maxVisibleColumns?: number                          // default 40; enforced on read and on set
    fixedVisibleColumnIds?: string[]                    // ids forced to visible=true on read
    fixedPins?: { left?: string[]; right?: string[] }   // positions enforced on read
    onWarn?: (message: string) => void                  // injected notification; defaults to console.warn
  }
): [ColumnConfigState, (next: ColumnConfigState) => void]
```

**Storage key:** `datagrid:config:<tableInstanceId>:v1`

**Value shape:**

```ts
type ColumnConfigState = {
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnSizing: Record<string, number>
  columnPinning: { left: string[]; right: string[] }
  schemaVersion: 1
}
```

**Validation on read:**

- If `columnVisibility` exceeds `maxVisibleColumns` `true` values: trim to the first N by `columnOrder`, call `onWarn(...)`.
- Unknown column ids in any field: silently dropped.
- `fixedVisibleColumnIds` missing from visibility: forced to `true`.
- `fixedPins` columns in wrong zone or order: moved to the canonical position.
- Parse failure: start from defaults.

**Write behavior:** same validation applied on `setConfig` before persisting.

**No cross-tab sync** in v1. Last write wins.

### What this helper does NOT cover

- View state (pagination, sort, filters) — page's concern.
- URL reading/writing — page's concern.
- Cross-device sync (server-side persist) — out of scope.

## Guidance for pages implementing URL view state

Pattern:

```tsx
// Page-owned URL view state hook. The grid doesn't care what's inside —
// it just needs [view, setView] that behaves like controlled React state.
function useMyUrlViewState(): [DataGridView<MyFilters>, (next: DataGridView<MyFilters>) => void] {
  // 1. Parse URL on mount (and on popstate)
  // 2. Reconcile with whatever storage backend you have (localStorage opaque id, BE view service, raw params, or a mix)
  // 3. On state change, write to URL and backend
  // 4. Return current state + setter
}

// Usage in page:
const [view, setView] = useMyUrlViewState()
const [columnConfig, setColumnConfig] = useLocalStorageColumnConfig('my-grid-v1')
const grid = useDataGrid({
  view, onViewChange: setView,
  columnConfig, onColumnConfigChange: setColumnConfig,
  rowCount,
})
```

The page's URL hook does NOT re-implement transition rules (page reset on sort, selection clear on filter). Those live in `useDataGrid`'s semantic setters. The URL layer is a dumb sink and source for the `view` object.

### Products page specifically

Keep the existing production URL hook untouched. It already handles `filterView=xxx&page&pageSize&skuId=...&skuId=...` with the reconciliation rule where `filterView` overrides raw params. Wrap its output as `[view, setView]` and pass into `useDataGrid`. No changes to that file required for this refactor.

## What NOT to build in v1

- **Pluggable URL adapters** (persistence backend abstraction, history adapters). YAGNI.
- **`useInlineUrlViewState` / `useOpaqueIdUrlViewState` helpers.** Build a shared abstraction only after a second concrete consumer exists. Products already has its own; don't abstract from N=1.
- **Server-side view persistence.** Out of scope.
- **Cross-device sync.** Out of scope.

## Open / TBD

- **Column config schema evolution.** `:v1` in the key lets us break compat cleanly. A migration registry (`migrations[fromVersion] → toVersion`) can run on read when we need it. Not in v1.
- **Eviction.** Not needed — column config is one entry per `tableInstanceId`, small, bounded.
- **Notification channel.** `onWarn` is dependency-injected. The helper never imports antd directly. Default: `console.warn`. Consumers wire it to their toast system if they want user-visible feedback.
