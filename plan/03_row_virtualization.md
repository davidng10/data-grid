# 03 — Row Virtualization

## Scope

Row virtualization only. No column virtualization. Uses `@tanstack/react-virtual` v3.

## Fixed row height (v1)

- Default `rowHeight: 40`, configurable via prop.
- All cells truncate overflow with `text-overflow: ellipsis` + `title` attribute tooltip.
- Multi-select / chip cells use a fixed-height container with `overflow: hidden`. Overflowing chips show a `+N` badge.
- Rationale: dynamic measurement + sticky pinned columns + resize is a well-known jank source. Truncation cost is acceptable.

Dynamic height is explicitly deferred. If we later need it, the migration is: swap `estimateSize` to return measured heights, enable `measureElement`, and absorb the scroll jank that comes with it.

## Setup

```ts
const rowVirtualizer = useVirtualizer({
  count: data.length,                      // rows on the current page (typically 100)
  getScrollElement: () => bodyRef.current,
  estimateSize: () => rowHeight,
  overscan: 10,
})

const totalSize = rowVirtualizer.getTotalSize()
const virtualRows = rowVirtualizer.getVirtualItems()
```

- Body container: `position: relative; overflow-y: auto`.
- Total-height spacer: `position: relative; height: ${totalSize}px; width: 100%`.
- Each virtual row: `position: absolute; top: ${virtualRow.start}px; left: 0; right: 0; height: ${rowHeight}px; display: flex`.

## Overscan tuning

- Start at 10 rows.
- Expect the main perf failure mode is per-cell render cost, not per-row overhead. Don't over-tune overscan before profiling.

## Edit-during-scroll contract (phase 2 precondition)

**Problem.** The user double-clicks a cell to edit. They scroll. The row exits the overscan window. The row's DOM unmounts. The editor component unmounts mid-edit. Draft value lost.

**Solution.** Editor state lives *above* the virtualizer.

1. `activeEditor: { rowId, columnId, draftValue } | null` is a top-level state held in `useProductsGrid` (or in the `<DataGrid />` itself if uncontrolled). It is NOT stored on the cell component.
2. When a cell renders and its `{ rowId, columnId }` matches `activeEditor`, it renders in edit mode, initialized from `activeEditor.draftValue`.
3. When a cell in edit mode unmounts (scrolled out), React calls its cleanup — the cell calls `onActiveEditorChange({ ...activeEditor, draftValue: currentDraft })` to push the latest draft up before unmounting.
4. When the user scrolls back and the row re-mounts, the cell sees `activeEditor` still matches and re-enters edit mode with the preserved draft.
5. On commit (Enter / blur / starting a new edit elsewhere): `onCommitEdit(rowId, columnId, draftValue)` → hook decides what to do (mutate BE, optimistic update). Clears `activeEditor`.
6. On cancel (Esc): sets `activeEditor` to `null`, draft discarded.

**Why rowId not rowIndex.** Row identity must be stable across sort and refetch. `rowIndex` shifts; `rowId` (SKU) does not. A mid-edit refetch might re-order rows — the editor follows its row.

**Commit-on-focus-move.** If the user clicks another cell to edit, the previous cell's draft is committed automatically (Excel behavior). This is the only "auto-commit" case; all others require explicit user action.

**Practical note.** Phase 1 does NOT implement any of this. It sets up the `activeEditor` prop, the `isEditing` cell prop, and the callbacks. No editor components exist yet. `allowInlineEdit: false` in phase 1.

## Scroll reset rules

| Event | Reset scroll to top? |
|---|---|
| Page change | Yes |
| Sort change | Yes |
| Filter change (via props) | Yes |
| Column visibility change | No |
| Column reorder | No |
| Column resize | No |
| Column pin/unpin | No |

Reset is: `bodyRef.current.scrollTop = 0`.

## Imperative handle

```ts
type DataGridHandle = {
  scrollToRow: (rowIndex: number, options?: { align?: 'start' | 'center' | 'end' }) => void
  scrollToTop: () => void
}
```

Exposed via `forwardRef`. Uses `rowVirtualizer.scrollToIndex` internally.

Used in phase 2 for e.g. "jump to the row you just edited after undo".

## Profiling checkpoints

Run these before calling phase 1 done:

1. **100 rows × 30 text columns.** Expected: initial render < 16ms, scroll stays at 60fps.
2. **100 rows × 30 mixed (text / number / single-select / multi-select) columns.** Expected: still 60fps scroll. If not, the bottleneck is per-cell render cost, not virt setup.
3. **Rapid scroll from top to bottom.** No frame drops. No layout thrash from sticky columns.
4. **Horizontal scroll with 50 middle columns at 200px each.** No tear. Header stays in sync.

Profiling tool: React DevTools Profiler for render cost; Chrome Performance tab for scroll jank. Don't profile on vibes.

## Open / TBD

- **Overscan for editing.** If an edit is active in a row that's at the edge of the overscan window, scrolling one pixel could unmount and remount rapidly. Might need `overscan: 20` when an editor is active. Profile before implementing.
- **Variable row height v2 trigger.** What UX need would force us to move to dynamic height? Probably long single-line text that users want wrapped. Note for future.
- **Dynamic `estimateSize` with caching.** Also future.
