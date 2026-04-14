# 05 — Selection: Rows + Cell Ranges

Two independent selection systems. They coexist without interfering.

## Row selection

### UI
- A pinned-left checkbox column injected by the grid when `allowRowSelection` is true.
- Column config (internal, not user-editable):
  - id: `__select__`
  - width: 44
  - `fixedPin: true`, `pin: 'left'`
  - `fixedVisible: true`
  - `fixedPosition: true`
- Header checkbox: "select all on current page" with `indeterminate` state when some (not all) visible rows are selected.
- Row checkbox: standard tri-state.

Hidden entirely when `allowRowSelection: false`.

### State shape
`rowSelection: Record<string, boolean>` — TanStack's default shape. Key is `getRowId(row)` (SKU, for products).

### Semantics

| Event | Selection behavior |
|---|---|
| Click row checkbox | Toggle that row id. |
| Click header checkbox | If all visible rows selected, deselect them all. Otherwise select all visible rows. Affects current page only. |
| Shift-click row checkbox | Select range from last-clicked to current (visible rows only). |
| Change page | Preserve selection across pages. User can accumulate selection across paged data. |
| Change sort | Preserve selection. |
| Apply filter | **Clear selection.** The selected rows may no longer match the filter — less confusing to clear than to surface phantom selections. |
| Change column visibility / reorder / resize / pin | Preserve selection. |

"Select all across all pages" is **not** offered in v1. If later needed, add a banner: "1,247 rows selected on this page. [Select all 8,342 matching rows]" — but defer.

### Exposed to consumer
The hook exposes `selection: { rowIds: string[], clear: () => void }` for the page to render a "X selected" action bar above the grid.

### Row selection vs cell range selection
- Clicking a row checkbox does NOT clear cell range selection.
- Starting a cell range drag does NOT clear row selection.
- They're two separate state slices with no interaction.

## Cell range selection

### State shape

```ts
type CellRangeSelection = {
  anchor: { rowIndex: number; columnId: string }   // where mousedown started
  focus:  { rowIndex: number; columnId: string }   // current cursor / where mouseup ended
}

// `null` means no range active.
```

- `rowIndex` is into the current page's `data` array (transient — changes on page/sort/filter).
- `columnId` is stable.
- The rectangle is: `[min(anchor.rowIndex, focus.rowIndex), max(..)] × [min visual col index, max visual col index]`.
- Visual column index is resolved through the current `columnOrder` + `columnPinning` + `columnVisibility`.
- A single-cell click is a 1×1 range.

### Why index-based not DOM-based
Virtualized-out rows are not in the DOM. DOM walking can't find them. Index-based math is O(1) per cell.

### Computing "is this cell in the range"

```ts
function isInRange(rowIndex: number, columnId: string, range: CellRangeSelection, visualColIndex: (id: string) => number): boolean {
  if (!range) return false
  const rMin = Math.min(range.anchor.rowIndex, range.focus.rowIndex)
  const rMax = Math.max(range.anchor.rowIndex, range.focus.rowIndex)
  if (rowIndex < rMin || rowIndex > rMax) return false
  const cIdx = visualColIndex(columnId)
  const cMin = Math.min(visualColIndex(range.anchor.columnId), visualColIndex(range.focus.columnId))
  const cMax = Math.max(visualColIndex(range.anchor.columnId), visualColIndex(range.focus.columnId))
  return cIdx >= cMin && cIdx <= cMax
}
```

### Performance note

Re-rendering every cell on every range-mousemove event is wasteful. Two options:

1. **Accept the re-render.** 4000 cells × `React.memo` + cheap comparator. Start here.
2. **Per-cell store subscription.** Use a tiny store (`zustand` with a selector per cell) so only cells whose `isInRange` value changed re-render. Cuts work to O(perimeter).

**Decision:** ship option 1. Move to option 2 only if profiling shows it matters. Do not pre-optimize.

### Mouse interactions

| Event | Effect |
|---|---|
| `mousedown` on cell body | Set anchor=focus=that cell. Start a "dragging" flag. |
| `mouseenter` on cell (while dragging) | Update focus. |
| `mouseup` anywhere | End dragging. Range persists. |
| `click` outside grid body | Clear range. |
| `contextmenu` on cell in range | Keep range. Fire `onRangeContextMenu(e, range)`. Consumer renders the menu. |
| `contextmenu` on cell outside range | Collapse range to 1×1 on that cell. Fire `onRangeContextMenu`. |
| `mousedown` on cell with Shift held | Extend focus from existing anchor (don't reset anchor). |

**Do not** use native browser selection for this. The grid should call `e.preventDefault()` on mousedown inside cells and handle selection manually. Native selection fights with sticky columns and virtualization.

### Keyboard interactions

Phase 1 ships these; defer more advanced keyboard nav to phase 2.

| Key | Effect |
|---|---|
| Arrow keys | Move focus by one cell, collapse to 1×1. |
| Shift + arrow | Extend focus from anchor. |
| Esc | Clear range. |
| Ctrl/Cmd + C | Fire `onRangeCopy(range, tsv)`. Grid provides default TSV serialization; consumer can override. |
| Ctrl/Cmd + A | Select all visible cells on current page (from first visible to last visible row × first to last column in visual order). |

**Phase 1 keyboard scope:** ship arrow, shift+arrow, Esc, Ctrl+C, Ctrl+A. Focus management: grid body has `tabIndex={0}` so it can receive keyboard events. The grid tracks a "focused cell" that defaults to anchor on drag end.

### Callback API (phase 1)

```ts
type DataGridProps<TRow> = {
  // ...
  onRangeContextMenu?: (e: MouseEvent, range: CellRange) => void
  onRangeCopy?: (range: CellRange, defaultTsv: string) => void
}
```

- `onRangeContextMenu` is called on right-click. The consumer renders a menu. Grid does NOT provide one.
- `onRangeCopy` is called on Ctrl+C. Default behavior: grid writes the default TSV to the clipboard itself via `navigator.clipboard.writeText`. If the consumer provides the callback, the grid calls it and lets the consumer decide whether to write to clipboard.

### Default TSV serialization

```
Col1\tCol2\tCol3\n
Col1\tCol2\tCol3\n
```

- Newlines between rows, tabs between cells.
- Multi-select values joined with `, `.
- `null` / `undefined` → empty cell.
- RTF values: strip HTML to plain text.
- Dates: ISO string by default. Consumers can override in phase 2.

### Clear conditions

Range clears on:
- Page change
- Sort change
- Filter change (via prop)
- Column visibility change that removes a column inside the current range
- Clicking outside the body
- Esc
- `allowRangeSelection` becoming `false`

Range does NOT clear on:
- Row selection change
- Column reorder / resize / pin (range follows columns by id, not visual index)

### Scroll-while-dragging

- If the mouse leaves the vertical viewport while dragging, auto-scroll the body container (8px per frame, accelerating if further out).
- If the mouse leaves the horizontal viewport of the middle zone, auto-scroll horizontally.
- Pinned columns do not auto-scroll (they're always visible).

**Phase 1 scope:** basic auto-scroll (no acceleration curve). Tune after use.

## Interaction between the two selection systems

- They share no state.
- The pinned-left checkbox column is NOT part of cell range selection. Clicking it starts row selection, not a range. The grid registers `mousedown` on checkbox cells as "checkbox intent" and does not start a range drag.
- Mouse drag from a checkbox cell does NOT start a range (it's a no-op on drag; click is the only action).

## Open / TBD

- **Focused cell after page navigation.** Does arrow-key focus persist across page boundaries? I'd say no — each page has its own focus, reset to top-left on page change. Confirm.
- **Ctrl+C default behavior.** Writes to clipboard automatically or fires callback only? I default to "writes automatically, but consumer callback runs first and can override." Confirm.
- **Select column or row by clicking header/row number?** Excel has this. Not in v1.
- **Copy format options.** TSV only in v1. HTML / CSV / JSON are future.
