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
| `mousedown` on cell body | Set anchor=focus=that cell. Start a "dragging" flag. Set focused cell. |
| `mouseenter` on cell (while dragging) | Update focus. |
| `mouseup` anywhere | End dragging. Range persists. |
| `click` outside grid body | Clear range. |
| `contextmenu` on cell in range | Keep range. Fire `onRangeContextMenu(e, range)`. Consumer renders the menu. |
| `contextmenu` on cell outside range | Collapse range to 1×1 on that cell. Fire `onRangeContextMenu`. |
| `mousedown` on cell with Shift held | Extend focus from existing anchor (don't reset anchor). |

**Do not** use native browser selection for this. The grid should call `e.preventDefault()` on mousedown inside cells and handle selection manually. Native selection fights with sticky columns and virtualization.

### Auto-scroll while dragging

If the mouse leaves the body's vertical or horizontal viewport while dragging a range, the grid auto-scrolls the body container so the user can extend the range past visible bounds.

- **Phase 1 scope:** basic constant-rate auto-scroll (8 px/frame via `requestAnimationFrame`) when the cursor sits in a 24px gutter inside each viewport edge during a drag. No acceleration curve — tune later from real use.
- The auto-scroll loop is gated on the dragging flag; releasing the mouse cancels the next frame.
- Pinned columns do not participate in horizontal auto-scroll (they're always visible by definition; only the middle zone scrolls horizontally).
- Auto-scroll does not run for keyboard-driven range extension (`Shift+Arrow`) — `scrollToRow` / `scrollIntoView` is enough there because the focus moves one cell at a time.

### Keyboard interactions

Phase 1 ships these; defer more advanced keyboard nav to phase 2. **All grid keyboard handling is gated on `focusedCell !== null`** — see "Focused cell" below for why. When no cell is focused, the grid does not `preventDefault` arrow keys, so the browser handles them natively (page scroll).

| Key | Effect (only when a cell is focused) |
|---|---|
| Arrow keys | Move focus by one cell, collapse to 1×1. |
| Shift + arrow | Extend focus from anchor. |
| Esc | Clear range. Focus stays. |
| Ctrl/Cmd + C | Fire `onRangeCopy(range, ctx)` if provided (see Callback API below). |
| Ctrl/Cmd + A | Select all visible cells on current page (anchor → top-left, focus → bottom-right). Works even with no prior focus, because Ctrl+A is unambiguous; sets focus to bottom-right after. |

**Phase 1 keyboard scope:** ship arrow, shift+arrow, Esc, Ctrl+C, Ctrl+A. Focus management: grid body has `tabIndex={0}` so it can receive keyboard events. The grid tracks a "focused cell" — see next section.

### Focused cell

The "focused cell" is `{ rowIndex, columnId } | null`, separate from the cell range. It's the cursor — where arrow keys move from, the implicit 1×1 selection for Ctrl+C if no range is active, and the anchor seed for `Shift+Arrow` from a no-range state.

**Mutations:**

| Event | Effect on focused cell |
|---|---|
| Click on a cell | Set focused cell to that cell. |
| `mousedown` (range start) | Set focused cell to the anchor cell. |
| Range drag (`mouseenter` while dragging) | Move focused cell with the focus endpoint. |
| Arrow / Shift+Arrow | Move focused cell. |
| Ctrl+A | Set focused cell to bottom-right of the resulting range. |
| Esc | Range clears; **focus stays**. |
| Page change (`pageIndex` updated) | Focus clears (`null`). |
| Filter / sort change | Focus clears (range already clears here too). |
| Page size change | Focus clears. |

**Strict no-op when `focusedCell === null`:** the grid does not intercept arrow keys / Shift+Arrow / Ctrl+C in this state. They flow through to the browser, which means **arrow keys produce native page scroll** as the user expects when nothing is focused. Cell traversal only activates after the user clicks (or starts a drag) inside the grid. Ctrl+A is the one exception — it always works because there's no ambiguity about what "select all" means.

**Why this design:** simpler than (a) reset-to-top-left (no surprise jump to a cell the user wasn't looking at) and preserves familiar browser behavior on a fresh page. Cost is one extra click after page navigation if the user wants to keyboard-nav — acceptable.

### Callback API (phase 1)

```ts
type DataGridProps<TRow> = {
  // ...
  onRangeContextMenu?: (e: MouseEvent, range: CellRange) => void

  // Ctrl+C: fired only if provided. Grid passes a getCellValue helper and the
  // resolved column list (in current visual order, including pinned). Consumer
  // returns the string to write to the clipboard, or null/undefined/void to
  // signal "I handled it" (or "do nothing"). If the consumer wants the
  // built-in TSV behavior, they call `defaultRangeToTSV(...)` and return its
  // result.
  onRangeCopy?: (
    range: CellRange,
    ctx: {
      getCellValue: (rowIndex: number, columnId: string) => unknown
      columns: DataGridColumnDef<TRow>[]   // visible columns, visual order
    }
  ) => string | null | void
}
```

- `onRangeContextMenu` — grid marks/preserves the range, fires the event. Consumer renders their own menu (Copy, Bulk edit, Export, whatever they want).
- `onRangeCopy` — grid does **not** ship a baked-in default. If the prop is omitted, Ctrl+C is a no-op inside the grid. If the prop returns a string, the grid writes it to the clipboard via `navigator.clipboard.writeText`. If it returns `null` / `undefined` / `void`, the grid writes nothing (consumer either wrote it themselves or chose to drop the event).

**Why no built-in default?** The grid sees raw `accessor` output, not rendered cell text. A `MultiSelectCell` showing chips, a `DateCell` showing "yesterday 3pm", a custom `BadgeCell` — none of them serialize sensibly via `String(value)`. Once a default ships it locks in (consumers depend on the exact whitespace, date format, null encoding) and can't be changed without breaking everyone. Forcing the consumer to opt in keeps the grid's contract narrow and lets each schema own its own serialization.

### Helper: `defaultRangeToTSV`

Exported from `@/components/DataGrid` as a convenience. Most consumers will use it verbatim:

```ts
import { defaultRangeToTSV } from '@/components/DataGrid'

<DataGrid
  onRangeCopy={(range, { getCellValue, columns }) =>
    defaultRangeToTSV(range, getCellValue, columns)
  }
/>
```

Behavior of `defaultRangeToTSV`:

```
Col1\tCol2\tCol3\n
Col1\tCol2\tCol3\n
```

- Newlines between rows, tabs between cells.
- Iterates the visible-column slice that the range covers, in visual order.
- For each cell: calls `getCellValue(rowIndex, columnId)` and coerces to string.
  - `null` / `undefined` → empty string.
  - `Array` → elements coerced to string and joined with `, `.
  - `Date` → `.toISOString()`.
  - Plain object → `JSON.stringify(value)` (escaped — see below).
  - Anything else → `String(value)`.
- Tabs / newlines / carriage returns inside any value are replaced with a single space (so the TSV stays parseable in Excel / Google Sheets).

`defaultRangeToTSV` is a pure function. Consumers can wrap it (e.g. transform per-column, prepend a header row), call it conditionally, or skip it entirely.

**Future / phase 2 (not shipping in phase 1):** per-column `toClipboard?: (value, row) => string` on `DataGridColumnDef`, consulted by `defaultRangeToTSV`. Adds locality (the cell renderer co-locates display + copy) without changing this API. Defer until a real consumer hits a wrong-default case.

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

## Interaction between the two selection systems

- They share no state.
- The pinned-left checkbox column is NOT part of cell range selection. Clicking it starts row selection, not a range. The grid registers `mousedown` on checkbox cells as "checkbox intent" and does not start a range drag.
- Mouse drag from a checkbox cell does NOT start a range (it's a no-op on drag; click is the only action).

## Open / TBD

- **Select column or row by clicking header/row number?** Excel has this. Not in v1.
- **Copy format options.** Helper ships TSV only in v1. HTML / CSV / JSON are future — consumer can write their own `onRangeCopy` today.
- **Per-column `toClipboard` hook.** Phase 2 candidate (see Helper section above). Not in v1.

## Resolved (was open)

- **Focused cell after page navigation.** Decision: clear (`null`). When `focusedCell === null`, grid does not intercept arrow keys → native browser scroll. Cell traversal only activates after the user clicks. See "Focused cell" section above.
- **Ctrl+C default behavior.** Decision: no built-in default. Grid fires `onRangeCopy(range, ctx)` only if the prop is provided; consumer returns the string to write (or `defaultRangeToTSV(...)` for the canned format). See "Callback API" + "Helper" sections above.
