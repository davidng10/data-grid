# 06 — Cell Rendering

## Design principle: zero coupling, explicit over implicit

The grid owns no cell type enum, no type registry, and no renderer lookup table. Every column either:

1. Provides a `cell` component directly on its column def, OR
2. Lets the grid render `String(value ?? '')` via `DefaultCell` — ugly for non-string values, intentionally so. The ugliness is a signal: "set a `cell` on this column."

No `cellRenderers.byKey`. No `cellRenderers.byType`. No `column.type`. Just `column.cell`.

## Column def — the relevant fields

```ts
type DataGridColumnDef<TRow, TValue = unknown> = {
  id: string
  header: string | ((ctx: HeaderContext<TRow>) => ReactNode)
  accessor: (row: TRow) => TValue

  cell?: CellRenderer<TRow, TValue>       // defaults to DefaultCell (String(value ?? ''))
  editable?: boolean                       // phase 2 — grid wires dblclick/Enter only when true
  align?: 'left' | 'right' | 'center'      // pure styling hint, honored by DefaultCell and built-ins

  // sizing, pinning, visibility flags per 01_architecture.md
}
```

## Cell renderer contract

```ts
type CellRenderer<TRow = unknown, TValue = unknown> =
  React.ComponentType<DataGridCellProps<TRow, TValue>>

type DataGridCellProps<TRow = unknown, TValue = unknown> = {
  // Display
  row: TRow
  rowId: string
  rowIndex: number                    // index within current page (transient)
  column: DataGridColumnDef<TRow, TValue>
  value: TValue
  align: 'left' | 'right' | 'center'  // from column.align, or inherited default

  // Edit mode (phase 2 — phase 1 cells can ignore entirely)
  isEditing: boolean
  draftValue: TValue | undefined
  setDraftValue: (next: TValue) => void
  commitEdit: () => void
  cancelEdit: () => void

  // Selection (phase 1)
  isInRange: boolean
  isRangeAnchor: boolean
  isRangeFocus: boolean

  // Consumer passthrough
  extras: Record<string, unknown>     // from DataGrid cellExtras prop
}
```

Phase 1 cells use `row`, `value`, `align`, `isInRange`, `extras`. Phase 2 adds the edit fields. The contract is stable across phases — no breaking change when editing ships.

## Default cell — the "do nothing special" fallback

```tsx
const DefaultCell: CellRenderer = ({ value, align }) => {
  const text = value == null ? '' : String(value)
  return (
    <span
      title={text}
      style={{
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
```

Behavior:
- `null` / `undefined` → empty cell
- `"hello"` → `"hello"`
- `42` → `"42"`
- `true` → `"true"`
- `["a", "b"]` → `"a,b"` (Array's `toString` comma-joins)
- `{ a: 1 }` → `"[object Object]"`
- `new Date()` → a long locale-dependent date string

The object and date cases are **intentionally ugly**. Document loudly in the README. The expected flow is: you see the ugly output once, shrug, and import `DateCell` or write a custom `cell`.

## Built-in cells (library exports)

Shipped from `src/components/DataGrid/cells/`. Consumers import what they need:

```ts
import {
  DefaultCell,       // the fallback described above — rarely imported directly
  TextCell,          // trimmed string, title tooltip, ellipsis overflow
  NumberCell,        // right-aligned, locale thousands separator
  SingleSelectCell,  // antd Tag with a color
  MultiSelectCell,   // chips with "+N more" overflow
  BooleanCell,       // check / cross icon
  DateCell,          // locale date format
  DateTimeCell,      // locale datetime format
  // RTFCell          // phase 2 — placeholder in phase 1, renders "[RTF]"
} from '@/components/DataGrid'
```

Each built-in cell:

1. Handles the display-mode path (with the `align` hint)
2. **Handles the edit-mode path** (renders an input when `isEditing === true`)
3. Uses antd internally where helpful (`Tag`, `Tooltip`, `Modal`, `DatePicker`, `InputNumber`, etc.)
4. Is memoized with a shallow comparator on `value`, `isEditing`, `isInRange`, `align`

Consumers who use built-in cells on `editable: true` columns get inline editing for free. Consumers with custom cells opt in by handling the edit props.

### Example built-in cell with edit mode

```tsx
const NumberCell: CellRenderer<any, number> = ({
  value, align, isEditing, draftValue, setDraftValue, commitEdit, cancelEdit,
}) => {
  if (isEditing) {
    return (
      <InputNumber
        value={draftValue ?? value}
        onChange={(next) => setDraftValue(next ?? 0)}
        onBlur={commitEdit}
        onPressEnter={commitEdit}
        onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
        autoFocus
        style={{ width: '100%' }}
      />
    )
  }

  return (
    <span style={{ textAlign: align ?? 'right', width: '100%' }}>
      {value?.toLocaleString() ?? ''}
    </span>
  )
}
```

One component, two branches. No separate "editor component," no parallel registry. A consumer passing `cell: NumberCell` on an `editable: true` column gets both modes with zero extra code.

## Inline edit architecture (phase 2 seam in phase 1)

Three-layer split. None of the layers "owns" editing alone:

| Concern | Owner |
|---|---|
| Which cell is active, draft storage, entry/exit, scroll preservation, commit-on-focus-move, keyboard shortcuts (dblclick / Enter / Esc) | Grid (`useDataGrid`) |
| Input UI, local UI state (e.g. "is the date picker popover open?"), how keystrokes map to draft value | Cell |
| Persisting the committed value to BE, error handling, data refresh after commit | Consumer (via `onCommitEdit` callback) |

The cell is a **reactive participant** in the grid's state machine, not the state owner. Same pattern as a controlled `<input>` — the input doesn't own its value, React does.

### Grid-level state (phase 1 seam, phase 2 wires up)

```ts
// Internal to useDataGrid
const [activeEditor, setActiveEditor] = useState<{
  rowId: string
  columnId: string
  draftValue: unknown
} | null>(null)
```

Entry points (grid-level event handlers, only active when `column.editable === true && allowInlineEdit === true`):

- Double-click on a cell → `setActiveEditor({ rowId, columnId, draftValue: currentValue })`
- Enter key while cell is focused → same
- Typing a character while cell is focused → same, with the character as initial draft (phase 2 polish)

Exit points:

- `commitEdit()` called by the cell → fire `onCommitEdit({ rowId, columnId, value: draftValue })`, await if Promise, clear `activeEditor` on success (keep open on error)
- `cancelEdit()` called by the cell → clear `activeEditor`, draft discarded
- Esc key → cancelEdit
- Click on a DIFFERENT cell while editing → commit the previous cell first (Excel behavior), then open new edit

Scroll-preservation: per `03_row_virtualization.md`, the draft lives in `activeEditor` (above the virtualizer), not on the cell. When a row re-mounts after scroll, the cell reads `activeEditor` and re-enters edit mode with the preserved draft.

### Consumer callback

```ts
useDataGrid({
  ...
  onCommitEdit?: (update: {
    rowId: string
    columnId: string
    value: unknown
  }) => void | Promise<void>
})
```

On commit:
- Grid calls `onCommitEdit`
- Consumer does the mutation (e.g., `await patchProduct(rowId, { [columnId]: value })`)
- Consumer updates local data (or the grid refetches — consumer's choice)
- If the callback throws or rejects: grid keeps `activeEditor` open so the user can fix and retry. Consumer shows their own error toast.
- Phase 1: `onCommitEdit` is unused because `allowInlineEdit` defaults to false. Phase 2 wires it up.

### If a custom cell forgets to handle `isEditing`

Grid's state machine still runs: `activeEditor` gets set, keyboard listeners fire, the cell re-renders with `isEditing: true`. But the cell's render function doesn't branch on it, so display mode is rendered instead. Visible symptom: the user double-clicks, nothing happens visibly, Esc has no effect (no input to blur).

Dev-mode warning: on the first render where `isEditing === true` for a column, if the component's rendered output looks identical to the `isEditing === false` render, log a warning: `"Column 'X' is editable: true but its cell component does not appear to handle isEditing."` (The detection is heuristic — e.g., re-render both branches in dev and compare — but even a simple "column is editable but cell ignored the prop" warning helps.)

## RTF specifically (phase 1)

Still a placeholder. No `RTFCell` exported in phase 1. Consumers with RTF data either:
- Pass `cell: TextCell` and accept the plain-text fallback
- Write their own custom cell with a read-only preview + a modal for full rendering (using DOMPurify + React's raw HTML escape hatch)

Phase 2 may ship an `RTFCell` with controlled editing; the decision is deferred.

## Consumer-side patterns

### Pattern 1: a simple grid with only built-ins

```tsx
const columns: DataGridColumnDef<Order>[] = [
  { id: 'id', header: 'Order #', accessor: (o) => o.id, cell: TextCell },
  { id: 'customer', header: 'Customer', accessor: (o) => o.customerName, cell: TextCell },
  { id: 'total', header: 'Total', accessor: (o) => o.total, cell: NumberCell, align: 'right', editable: true },
  { id: 'status', header: 'Status', accessor: (o) => o.status, cell: SingleSelectCell },
  { id: 'created', header: 'Created', accessor: (o) => o.createdAt, cell: DateTimeCell },
]
```

### Pattern 2: a per-column custom renderer

```tsx
const SkuLinkCell: CellRenderer<Product, string> = ({ value, extras }) => (
  <a onClick={() => (extras.onProductClick as any)?.(value)}>{value}</a>
)

const columns: DataGridColumnDef<Product>[] = [
  { id: 'sku.id', header: 'SKU ID', accessor: (p) => p.skuId, cell: SkuLinkCell, fixedPin: true, pin: 'left' },
  // ...
]

<DataGrid ... columns={columns} cellExtras={{ onProductClick }} />
```

No `byKey` registry needed. The component reference lives inline on the column def. `extras` passthrough for consumer-provided handlers is unchanged.

### Pattern 3: domain → cell mapper (Products page)

See `08_data_source_hook.md` for the full `mapAttrToCell` function.

## Default cell styling

- Padding: 12px horizontal, 0 vertical (row height owns the vertical)
- Font: inherit from body
- Overflow: `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`
- `title={String(value)}` attribute for native browser tooltip
- Alignment: from `align` prop (defaults to `'left'` when unset on the column)
- Range-selected: `background: rgba(24, 144, 255, 0.1); outline: 1px solid rgba(24, 144, 255, 0.4)`. Focus cell: heavier outline. Pick exact colors during visual pass.

## What this design does NOT do

- **No registry.** No `cellRenderers.byKey`, no `cellRenderers.byType`. Dropped entirely.
- **No `column.type` field.** No built-in type enum. Grid has zero opinion about value shapes.
- **No automatic type-to-editor mapping in phase 2.** The cell component handles both modes explicitly.
- **No default right-align for numbers.** The consumer either uses `NumberCell` (which defaults to right-align) or sets `align: 'right'` on the column def for the default cell.

## Open / TBD

- **Memoization strategy for built-in cells.** Default: `React.memo` with a shallow comparator. Custom cells opt in themselves. Flag if profiling shows hot paths where shallow comparison is too coarse.
- **Number formatting locale.** Read from React context (e.g., `useLocale()`) or accept a `formatNumber` function via `extras`. I'd say context.
- **Date formatting.** Same — from context. Don't bundle a date library; accept a `formatDate` from context or `extras`.
- **Dev-mode "cell ignored isEditing" warning.** Heuristic detection is tricky. Might settle for a simpler "column is editable: true but allowInlineEdit is false" warning, leaving the harder detection to user complaints.
- **Should `editable` be a predicate (`(row) => boolean`) for per-row editability?** Defer to phase 2. The seam accepts either a `boolean` or a function; start with boolean.
