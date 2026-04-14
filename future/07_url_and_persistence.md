# 07 — URL State and Persistence

## Future feature, do not implement.

## Problem recap
- Filter state can be arbitrarily large (1000-element `$in` arrays).
- CloudFront URL limit is ~8192 bytes.
- Refreshing the page must restore state.
- Browser back/forward must return to the previous view.
- Cross-user URL sharing is NOT a requirement (confirmed local-first).

## Design

### URL shape

```
/products?viewId=v_7k2a9f
```

- `viewId` is a short opaque id (8 random base36 chars).
- Nothing else lives in the URL. No filter values, no page number, no sort.
- Every navigation that should be undoable via back/forward mints a new `viewId` and pushes it with `history.pushState`.

### Storage shape — per-view (transient, history-linked)

**Key:** `datagrid:view:<tableInstanceId>:<viewId>`

**Value:**
```ts
type PersistedView = {
  pageIndex: number
  pageSize: number
  sorting: SortingState              // TanStack shape — single column in v1
  filters: FilterState               // BE-operator shape as-is
  createdAt: number                  // Unix ms, for LRU eviction
  schemaVersion: 1
}
```

- Filter state is stored raw. A 1000-element `$in` is ~20KB — comfortably under the ~5MB localStorage quota.
- Row selection is NOT persisted. Transient. See `05_selection.md` for rationale.
- Cell range selection is NOT persisted. Transient.
- Column visibility / order / sizing / pinning are NOT persisted here — they live in the config key below.

### Storage shape — per-instance config (long-lived)

**Key:** `datagrid:config:<tableInstanceId>:v1`

**Value:**
```ts
type PersistedColumnConfig = {
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnSizing: Record<string, number>
  columnPinning: { left: string[]; right: string[] }
  schemaVersion: 1
}
```

- Per `tableInstanceId`, not per `viewId`.
- Survives view changes, page navigation, filter changes.
- `:v1` in the key lets us break compat cleanly.
- `schemaVersion` inside the value is belt-and-braces (in case we want to migrate in-place without breaking the key).

### Why two separate keys

Per the user requirement: "refreshing the page should not lose column config." Column config must survive even if the user opens a fresh `?viewId`. Tying it to `viewId` would lose it on every history step.

## Validation on read

### Per-view
- If the key is missing: mint a new default view, replaceState, show "Restored to default view" toast.
- If parse fails: same as missing.
- If `pageIndex * pageSize > totalRows`: clamp to the last valid page after the first query returns. Don't block the bootstrap.
- If `sorting` references an unknown column id: drop it silently.
- If `filters` reference an unknown attribute: let the BE decide (it'll ignore unknown keys or return an error; the page handles it).

### Per-instance config
- If `columnVisibility` has > 40 `true` values: trim to the first 40 (by `columnOrder`), show a one-time toast on next visit.
- If ids in any field don't exist in the current `columns` prop: silently drop them.
- If `fixedVisible` columns are missing: force them to `true`.
- If `fixedPin` columns are on the wrong side: move them.
- If `fixedPosition` columns are in the wrong zone order: move them to the canonical position (front of left zone, back of right zone, or as specified by column def).
- On parse failure: start from defaults.

## History semantics — what mints a new `viewId`?

| Event | New viewId? | Rationale |
|---|---|---|
| Change page | Yes | Back button should return to previous page. |
| Change sort | Yes | Back button should undo sort. |
| Apply filter | Yes | Back button should undo filter. |
| Filter input keystroke | No | Would pollute history. |
| Change page size | Yes | Non-trivial state change. |
| Toggle column visibility | No | Persisted separately; not a "view" event. |
| Pin / unpin column | No | Same. |
| Reorder column | No | Same. |
| Resize column | No | Same (also: high frequency, would flood history). |
| Row selection change | No | Transient. |
| Cell range selection change | No | Transient. |
| Active editor change | No | Transient (phase 2). |

### API

```ts
useUrlViewState(tableInstanceId): {
  viewId: string
  state: PersistedView
  pushView: (next: Partial<PersistedView>) => void    // new viewId, new history entry
  replaceView: (next: Partial<PersistedView>) => void // same viewId, replaces history entry
}
```

`pushView` is called on apply-level events. `replaceView` is called on rare "fix up the current entry without creating history" cases (e.g., server correction after clamping page).

## Eviction strategy

- On every write to `datagrid:view:<instanceId>:<any>`, scan keys matching that prefix.
- If count > 50, delete oldest by `createdAt` until count === 50.
- This keeps any single instance's localStorage under ~1MB in practice (50 × ~20KB).
- Do NOT try to evict across `tableInstanceId` boundaries — each instance manages its own bucket.

## Bootstrap on page load

```ts
function bootstrap(tableInstanceId: string) {
  const url = new URL(window.location.href)
  let viewId = url.searchParams.get('viewId')

  if (!viewId) {
    viewId = mintViewId()
    url.searchParams.set('viewId', viewId)
    window.history.replaceState(null, '', url.toString())
  }

  const raw = localStorage.getItem(`datagrid:view:${tableInstanceId}:${viewId}`)
  let view: PersistedView
  if (!raw) {
    view = defaultView()
    writeView(tableInstanceId, viewId, view)
    // Optional: toast "Restored to default view" if viewId was in URL (stale paste)
  } else {
    view = parseAndValidate(raw) ?? defaultView()
  }

  const config = parseAndValidateConfig(
    localStorage.getItem(`datagrid:config:${tableInstanceId}:v1`)
  ) ?? defaultConfig()

  return { viewId, view, config }
}
```

## `popstate` handling

```ts
window.addEventListener('popstate', () => {
  const viewId = new URL(window.location.href).searchParams.get('viewId')
  if (!viewId) return
  const raw = localStorage.getItem(`datagrid:view:${tableInstanceId}:${viewId}`)
  const view = raw ? parseAndValidate(raw) : defaultView()
  setState(view)
  // Do NOT pushState — the browser already moved history.
})
```

## Filter state representation

The hook stores filters already in BE-operator shape (confirmed — filter UI owns construction). This keeps persistence dumb: serialize what the page gives, pass it straight to the API.

```ts
type FilterState = Record<string, Record<string, unknown>>
// example:
{
  "basicInfoName": { "$eq": "test" },
  "attr.color":    { "$in": ["red", "blue"] }
}
```

No schema on top. No translation layer.

## Cross-tab behavior

- Two tabs on the same table: last write wins on column config.
- No `storage` event listener in v1 (would require invalidating in-flight state).
- If the user complains, add it in a follow-up.

## Open / TBD

- **"Reset to default view" button.** Not in v1. Would clear the current `viewId`'s localStorage entry and push a new default view. Flag for later.
- **Schema migration.** When `PersistedView.schemaVersion` changes, what do we do? v1 is the first version, so this is a future concern. I'd plan a simple migration function registry keyed on version, running on read.
- **Toast library.** Depend on antd's `message` API. The grid doesn't call it directly — the hook does.
- **Default view values.** What's the default sort? Default page size? I'd default to `{ pageIndex: 0, pageSize: 100, sorting: [], filters: {} }`.
