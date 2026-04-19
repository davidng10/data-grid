# 06 — Cell Rendering

## Design principle: zero coupling, explicit over implicit

The grid owns no cell type enum, no type registry, and no renderer lookup table. Every column either:

1. Provides a `cell` component directly on its column def, OR
2. Lets the grid render `String(value ?? '')` via `TextCell` — ugly for non-string values, intentionally so. The ugliness is a signal: "set a `cell` on this column."

`TextCell` is both the only built-in cell shipped in phase 1 _and_ the implicit fallback when `column.cell` is unset. There is no separate `DefaultCell`. Other type-aware cells (`NumberCell`, `DateCell`, etc.) are deferred future work — the user will build them later as needed. For now, anything that isn't string-like either gets the ugly coercion or a custom inline `cell`.

No `cellRenderers.byKey`. No `cellRenderers.byType`. No `column.type`. Just `column.cell`.

## Column def — the relevant fields

```ts
type DataGridColumnDef<TRow, TValue = unknown> = {
  id: string;
  header: string | ((ctx: HeaderContext<TRow>) => ReactNode);
  accessor: (row: TRow) => TValue;

  cell?: CellRenderer<TRow, TValue>; // defaults to TextCell (String(value ?? ''))
  editable?: boolean; // phase 2 — grid wires dblclick/Enter only when true
  align?: "left" | "right" | "center"; // pure styling hint, honored by TextCell and any built-ins

  // sizing, pinning, visibility flags per 01_architecture.md
};
```

## Cell renderer contract

```ts
type CellRenderer<TRow = unknown, TValue = unknown> = React.ComponentType<
  DataGridCellProps<TRow, TValue>
>;

type DataGridCellProps<TRow = unknown, TValue = unknown> = {
  // Display
  row: TRow;
  rowId: string;
  rowIndex: number; // index within current page (transient)
  column: DataGridColumnDef<TRow, TValue>;
  value: TValue;
  align: "left" | "right" | "center"; // from column.align, or inherited default

  // Edit mode (phase 2 — phase 1 cells can ignore entirely)
  isEditing: boolean;
  draftValue: TValue | undefined;
  setDraftValue: (next: TValue) => void;
  commitEdit: () => void;
  cancelEdit: () => void;

  // Selection (phase 1)
  isInRange: boolean;
  isRangeAnchor: boolean;
  isRangeFocus: boolean;

  // Consumer passthrough
  extras: Record<string, unknown>; // from DataGrid cellExtras prop
};
```

Phase 1 cells use `row`, `value`, `align`, `isInRange`, `extras`. Phase 2 adds the edit fields. The contract is stable across phases — no breaking change when editing ships.

## `TextCell` — the only built-in, and the fallback

```tsx
const TextCell: CellRenderer = ({ value, align }) => {
  const text = value == null ? "" : String(value);
  return (
    <span
      title={text}
      style={{
        textAlign: align,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
};
```

Behavior:

- `null` / `undefined` → empty cell
- `"hello"` → `"hello"`
- `42` → `"42"`
- `true` → `"true"`
- `["a", "b"]` → `"a,b"` (Array's `toString` comma-joins)
- `{ a: 1 }` → `"[object Object]"`
- `new Date()` → a long locale-dependent date string

The object and date cases are **intentionally ugly**. Document loudly in the README. The expected flow is: you see the ugly output once, shrug, and either write a custom `cell` inline on the column def or (later) ship a richer built-in like `NumberCell` / `DateCell`. Phase 1 doesn't ship those.

## Built-in cells (library exports)

Phase 1 ships exactly one:

```ts
import { TextCell } from "@/components/DataGrid";
```

`TextCell` is described above. It's the fallback and the only named export. Display-only; the `isEditing` / `draftValue` / `commitEdit` / `cancelEdit` props exist on the contract but `TextCell` ignores them. Memoized with a shallow comparator on `value`, `align`, `isInRange`, `isEditing`.

### Deferred future cells

The following are **not** shipped in phase 1. The user will build them later as needs emerge — and when they do, the same shape and inline-edit pattern described below applies:

- `NumberCell` — right-aligned, locale thousands separator
- `SingleSelectCell` — antd Tag with a color
- `MultiSelectCell` — chips with "+N more" overflow
- `BooleanCell` — check / cross icon
- `DateCell` — locale date format
- `DateTimeCell` — locale datetime format

In phase 1, consumers needing these behaviors either (a) accept `TextCell`'s `String(value)` coercion or (b) write an inline custom `cell` on the column def. That's it.

### Future inline-edit pattern (reference for phase 2)

When a future cell is built, it will follow this shape — one component, two branches, no separate "editor component":

```tsx
// Illustrative only. Not implemented in phase 1.
const NumberCell: CellRenderer<any, number> = ({
  value,
  align,
  isEditing,
  draftValue,
  setDraftValue,
  commitEdit,
  cancelEdit,
}) => {
  if (isEditing) {
    return (
      <InputNumber
        value={draftValue ?? value}
        onChange={(next) => setDraftValue(next ?? 0)}
        onBlur={commitEdit}
        onPressEnter={commitEdit}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancelEdit();
        }}
        autoFocus
        style={{ width: "100%" }}
      />
    );
  }

  return (
    <span style={{ textAlign: align ?? "right", width: "100%" }}>
      {value?.toLocaleString() ?? ""}
    </span>
  );
};
```

A future consumer passing `cell: NumberCell` on an `editable: true` column would get both modes with zero extra code. None of that wires up in phase 1 because the cell doesn't exist.

## Inline edit architecture (phase 2 seam in phase 1)

Three-layer split. None of the layers "owns" editing alone:

| Concern                                                                                                                                 | Owner                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Which cell is active, draft storage, entry/exit, scroll preservation, commit-on-focus-move, keyboard shortcuts (dblclick / Enter / Esc) | Grid (`useDataGrid`)                   |
| Input UI, local UI state (e.g. "is the date picker popover open?"), how keystrokes map to draft value                                   | Cell                                   |
| Persisting the committed value to BE, error handling, data refresh after commit                                                         | Consumer (via `onCommitEdit` callback) |

The cell is a **reactive participant** in the grid's state machine, not the state owner. Same pattern as a controlled `<input>` — the input doesn't own its value, React does.

### Grid-level state (phase 1 seam, phase 2 wires up)

```ts
// Internal to useDataGrid
const [activeEditor, setActiveEditor] = useState<{
  rowId: string;
  columnId: string;
  draftValue: unknown;
} | null>(null);
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

### Pattern 1: a simple grid with only `TextCell`

```tsx
const columns: DataGridColumnDef<Order>[] = [
  { id: "id", header: "Order #", accessor: (o) => o.id }, // fallback: TextCell
  {
    id: "customer",
    header: "Customer",
    accessor: (o) => o.customerName,
    cell: TextCell,
  },
  {
    id: "total",
    header: "Total",
    accessor: (o) => o.total,
    cell: TextCell,
    align: "right",
  },
  {
    id: "status",
    header: "Status",
    accessor: (o) => o.status,
    cell: TextCell,
  },
  {
    id: "created",
    header: "Created",
    accessor: (o) => o.createdAt,
    cell: TextCell,
  }, // ISO/locale string via String()
];
```

In phase 1 you only get the string coercion. If that's not enough for a given column, drop to Pattern 2 and write a custom cell inline. Richer built-ins (Number/Date/etc.) come later.

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

## `TextCell` styling

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
- **No separate `DefaultCell`.** `TextCell` doubles as the fallback.
- **No right-align for numbers by default.** The consumer sets `align: 'right'` on the column def themselves.
- **No built-in cells beyond `TextCell` in phase 1.** `NumberCell` / `DateCell` / etc. are deferred.

## Open / TBD

- **Memoization strategy for built-in cells.** Default: `React.memo` with a shallow comparator. Custom cells opt in themselves. Flag if profiling shows hot paths where shallow comparison is too coarse.
- **Number formatting locale.** Read from React context (e.g., `useLocale()`) or accept a `formatNumber` function via `extras`. I'd say context.
- **Date formatting.** Same — from context. Don't bundle a date library; accept a `formatDate` from context or `extras`.
- **Dev-mode "cell ignored isEditing" warning.** Heuristic detection is tricky. Might settle for a simpler "column is editable: true but allowInlineEdit is false" warning, leaving the harder detection to user complaints.
- **Should `editable` be a predicate (`(row) => boolean`) for per-row editability?** Defer to phase 2. The seam accepts either a `boolean` or a function; start with boolean.
