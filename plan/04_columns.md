# 04 — Columns: Pinning, Reorder, Resize, Visibility

Four features that share state via TanStack Table but are independently toggleable via feature flags.

## Pinning

### Two flavors
1. **Fixed pinning** — set via column def `pin: 'left' | 'right'` + `fixedPin: true`. User cannot unpin or move across zones.
2. **Custom pinning** — user-initiated via the column header menu. Toggleable.

Both flavors share the same TanStack state: `columnPinning: { left: string[], right: string[] }`. The order of ids within each array defines visual order within that zone.

### Pin/unpin UX

Header cell renders a "3 vertical dots" button on hover. Clicking opens a small menu:

- **Pin left** / **Pin right** / **Unpin** (shown based on current pin state)
- **Move left** / **Move right** (scoped to current zone, disabled at edges or next to a fixed-position column)
- **Hide column** (disabled if `fixedVisible`)
- **Autosize column** (future — not in phase 1)

Menu items are disabled (not hidden) when forbidden by the column's `fixedPin` / `fixedPosition` / `fixedVisible` flags. Hover shows a tooltip explaining why.

### Pin/unpin state transitions

When user pins a currently-middle column to the left:
1. Remove its id from `columnOrder` position (it's unchanged actually — columnOrder contains all columns regardless of pin).
2. Append its id to `columnPinning.left`.
3. Call `onColumnPinningChange(next)`.

Middle-zone visual order is derived as: `columnOrder.filter(id => !left.includes(id) && !right.includes(id))`.

Pinned zones' visual order is the array order itself, not `columnOrder`.

### Fixed-position columns as walls

A column with `fixedPosition: true` cannot be swapped with its neighbors. Move-left/move-right on an adjacent column that would cross it is disabled.

## Reorder

### Scope
Within each zone only. To move a column into a different zone, user pins/unpins via the menu.

### Implementation
- `@dnd-kit/sortable` with THREE separate `SortableContext` instances (one per zone).
- Drag handle: the header cell itself. Click-and-drag from any non-interactive part of the header.
- On drop, compute the next order for that zone and call:
  - For middle zone: `onColumnOrderChange(nextFlatOrder)` — rebuild the full `columnOrder` array with the new middle order interleaved.
  - For pinned zones: `onColumnPinningChange({ left: nextLeft, right: nextRight })`.
- Columns with `fixedPosition: true` are rendered inside the SortableContext but marked `disabled` — they can't be picked up AND other columns can't be dropped onto their slot (enforced by a custom `collisionDetection` that skips their rects).

### Auto-scroll during drag
`@dnd-kit` has a built-in auto-scroll modifier. Enable it on the middle zone's horizontal scroller. Tune the threshold (default 20px from edge) if it feels too aggressive.

### Visual feedback
- Dragging column: 50% opacity, slight shadow.
- Drop target: 2px vertical blue line between columns.
- Snap on drop, no animation during drag (keep perf predictable).

## Resize

### Mechanics
- TanStack Table's `columnSizing` state + `columnSizingInfo`.
- `columnResizeMode: 'onChange'` — width updates live during drag.
- Resize handle: 6px-wide absolute element on the right edge of each header cell, `cursor: col-resize`, `z-index: 1` above the header content.
- Wire TanStack's resize callbacks: `header.getResizeHandler()` for `onMouseDown` and `onTouchStart`.

### Min/max
- Default `minWidth: 60`, `maxWidth: 800` — configurable per column.
- Clamped on write in `onColumnSizingChange`, not in render.

### Resize × pinning
- Resizing a pinned column works identically. The pinned zone's total width grows, sticky positioning still correct, middle scroll area shrinks.
- If the user resizes a pinned column so large that no middle content fits, they're allowed to do it. Don't clamp based on viewport width.

### Resize × virtualization
- Resizing doesn't affect row virtualization (row height is fixed).
- Horizontal scroll of the middle zone updates naturally via CSS.

### Persistence
`columnSizing` is part of column config — persisted in localStorage (see `07_url_and_persistence.md`).

## Column visibility ("column config")

### UI
A modal dialog (antd `Modal` is fine inside the consumer, or a custom one — not in the grid).

Layout:
- Search input at top (fuzzy match on column name) — important for the 1000-attribute case.
- Tabs or section headers: "System attributes" and "Custom attributes".
- Inside each section: a scrollable list of `<Checkbox label="..." />` rows with the column name and a small type tag.
- Footer: "X / 40 columns selected", **Cancel**, **Apply**.

### Rules
- **Fixed-visible columns**: checkbox is `checked` and `disabled`. Tooltip: "Always shown".
- **Max 40 checked**: if the user tries to check a 41st, reject the change and toast: "Maximum 40 columns. Uncheck one first." The checkbox remains interactive (don't disable unchecked 41st+ — that's confusing UX).
- **Cancel**: discard any pending changes, close modal.
- **Apply**: call `onColumnVisibilityChange(next)`, close modal.

### Modal state vs grid state
The modal holds a local "pending visibility" state while open. It does NOT call `onColumnVisibilityChange` on every click. Only on Apply. This matters because each change otherwise triggers a grid re-render.

### Validation on load
- If persisted visibility exceeds 40 `true` values: trim to first 40 (by `columnOrder`), log a warning, one-time toast on next visit.
- If persisted visibility has ids that don't exist in the current `columns` prop: silently drop them.
- If `fixedVisible` columns are missing from persisted visibility: force them to `true`.
- If parse fails entirely: start from defaults, silently.

### Where the modal lives
Outside the `<DataGrid />` component. The hook (`useProductsGrid`) exposes `{ columnConfig: { open, isOpen, ... } }` and the page renders the modal. This keeps the grid free of modal/dialog dependencies.

## Open / TBD

- **Drag handle placement.** I default to "drag from anywhere on the header." Alternative is a dedicated drag icon. User test; pick after a prototype.
- **Mobile/touch.** `@dnd-kit` supports touch, but the 3-dots menu is awkward on touch. Not a phase 1 concern per the desktop-first assumption — confirm.
- **Column freeze shadows.** Right-edge of pinned-left and left-edge of pinned-right should have a subtle box-shadow to indicate "there's more beyond." Small polish — include or defer.
- **Per-zone column width totals displayed anywhere?** No — just ambient feedback via layout.
- **Column auto-size (double-click resize handle to fit content)?** Defer.
