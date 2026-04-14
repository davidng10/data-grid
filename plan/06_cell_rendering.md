# 06 — Cell Rendering and Renderer Registries

## Renderer resolution

```ts
function resolveRenderer(column, registries) {
  return registries.byKey[column.id]
      ?? registries.byType[column.type]
      ?? DefaultCell
}
```

Order is deliberate: fixed-key override wins over type default. This is how the SKU ID column becomes a clickable link while still being a "text" type in every other respect.

## Cell renderer contract

```ts
type DataGridCellProps<TRow = unknown, TValue = unknown> = {
  // Data
  row: TRow
  rowId: string
  rowIndex: number                 // index within current page (transient)
  column: DataGridColumnDef<TRow>
  value: TValue

  // Edit mode (phase 2 uses these; phase 1 cells ignore)
  isEditing: boolean               // true when activeEditor matches this cell
  draftValue: TValue | undefined   // only meaningful when isEditing
  commitEdit: (next: TValue) => void
  cancelEdit: () => void
  setDraftValue: (next: TValue) => void

  // Selection (phase 1)
  isInRange: boolean
  isRangeAnchor: boolean
  isRangeFocus: boolean

  // Passthrough
  extras: Record<string, unknown>   // from DataGrid cellExtras prop
}

type CellRenderer<TRow = unknown, TValue = unknown> = React.ComponentType<DataGridCellProps<TRow, TValue>>
```

Phase 1 cells use `row`, `value`, `isInRange`, `extras`. Phase 2 adds the edit fields. The contract is stable across phases.

## Registries

### Fixed-key registry (consumer-provided)

Used for columns that need a special renderer regardless of their type.

```ts
// From useProductsGrid
const byKey = {
  'sku.id': ({ value, extras }) => (
    <a onClick={() => extras.onProductClick?.(value as string)}>{value as string}</a>
  ),
  'row.actions': ({ row, extras }) => extras.renderRowActions?.(row),
}
```

The consumer of `<DataGrid />` passes this via the `cellRenderers.byKey` prop along with `cellExtras` (the passthrough handlers).

### Type registry (grid built-in)

| Type | Renderer | Notes |
|---|---|---|
| `text` | `TextCell` | Plain text, ellipsis overflow. |
| `number` | `NumberCell` | Right-aligned, locale thousands separators. |
| `single-select` | `SingleSelectCell` | Colored tag (antd `Tag`). |
| `multi-select` | `MultiSelectCell` | Chips with `+N` overflow. |
| `rtf` | `RTFCell` | Placeholder — renders a dummy string. Revisit manually after grid is built. |
| `boolean` | `BooleanCell` | Check / cross icon. |
| `date` | `DateCell` | Locale-formatted date. |
| `datetime` | `DateTimeCell` | Locale-formatted timestamp. |

All built-in renderers live in `src/components/DataGrid/cells/`. They may use antd internally (`Tag`, `Modal`, `Tooltip`).

### Consumer overrides merge over built-ins

```ts
<DataGrid
  cellRenderers={{
    byKey: {
      'sku.id': SkuLinkCell,
    },
    byType: {
      text: CustomTextCell,   // overrides built-in TextCell for all text columns
    },
  }}
  cellExtras={{ onProductClick }}
/>
```

Merge strategy: `byKey` overrides `byType` overrides built-ins. No deep merging; replacement at the key level.

## Inline edit — state machine (architecture only, phase 1 leaves the seams)

```
DISPLAY ──(dblclick | Enter)──▶ EDITING(draft=value)
EDITING ──(Enter | blur | focus-other-cell)──▶ DISPLAY (commit)
EDITING ──(Esc)──▶ DISPLAY (cancel)
EDITING ──(scroll-out-of-view)──▶ still EDITING (draft preserved above virtualizer)
```

### Entry points
- Double-click: always enters edit mode.
- Enter with the cell focused (keyboard): enters edit mode.
- Typing any character while the cell is focused: enters edit mode with that character as the initial draft (Excel-style "start typing to replace"). Phase 2.

### Editor contract

```ts
type CellEditorProps<TValue = unknown> = {
  column: DataGridColumnDef<any>
  initialValue: TValue
  draftValue: TValue
  onDraftChange: (next: TValue) => void
  onCommit: () => void
  onCancel: () => void
  autoFocus: boolean
}

type CellEditor<TValue = unknown> = React.ComponentType<CellEditorProps<TValue>>
```

Per-type editors implement this interface. An editor registry parallel to the cell registry maps `type → CellEditor`.

### Phase 1 scope for editing
- Set up `activeEditor` prop + `onActiveEditorChange` callback.
- Set up `isEditing` flag in `DataGridCellProps`.
- Do NOT implement any `CellEditor`.
- Default `allowInlineEdit: false`.
- Cells with `isEditing: true` (which never happens in phase 1) are harmless no-ops.

The point is phase 2 is additive — no rewrite.

### Per-type editability config

A column is editable if:
1. `allowInlineEdit: true` on the grid
2. `column.editable !== false`
3. An editor exists in the registry for `column.type`

RTF is excluded from inline editing: simply don't register an RTF editor. Implicit.

## RTF specifically (phase 1)

Placeholder only. `RTFCell` renders a dummy string (e.g., `"[RTF]"`) regardless of the underlying value. No HTML parsing, no sanitization, no modal, no click handler, no DOMPurify dependency. Revisit this cell type manually after the rest of the grid is built — at that point decide whether to render sanitized HTML inline, open a modal, or do something else.

The point is to unblock phase 1 without spending time on RTF rendering decisions that don't affect the rest of the architecture.

## Multi-select rendering — sizing strategy

Multi-select cells with many values need a fit strategy:

**Option A: measured fit.** Use `ResizeObserver` on the cell to compute how many chips fit. Show those + `+N`. Accurate but complex; recalculates on column resize.

**Option B: fixed "first 3 + N".** Always show at most 3 chips followed by `+N more` if there are more. Simpler, slightly uglier, predictable.

**Decision:** Option B in v1. Revisit if design objects.

## Default cell styling

- Padding: 12px horizontal, 0 vertical (row height owns the vertical).
- Font: inherit from body.
- Overflow: `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`.
- `title={String(value)}` for native browser tooltip.
- Range-selected: `background: rgba(24, 144, 255, 0.1); outline: 1px solid rgba(24, 144, 255, 0.4)`. Focus cell: heavier outline. Pick exact colors during visual pass.

## Open / TBD

- **Cell renderer memoization.** Do we wrap built-in cells in `React.memo`? Yes, with a shallow comparator on `value`, `isInRange`, `isEditing`. Consumer overrides opt-in themselves.
- **Number formatting locale.** Read from app context (e.g., `useLocale()`). Not hardcoded.
- **Date formatting.** Same — from context. Don't bundle a date lib; accept a `formatDate` function from extras.
- **RTF sanitizer.** Out of phase 1 entirely — `RTFCell` is a dummy placeholder. Revisit (with DOMPurify or an alternative) when the user manually picks up that cell.
- **Custom row hover color.** Flag for visual design pass.
