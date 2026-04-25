import type { Column } from "../../components/DataGridV2";

export interface Row {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly status: "active" | "pending" | "archived";
  readonly amount: number;
  readonly createdAt: Date;
}

const FIRST_NAMES = [
  "Avery", "Jordan", "Reese", "Morgan", "Skylar", "Quinn", "Blair", "Rowan",
  "Dakota", "Ellis", "Sage", "Tatum", "Emerson", "Hayden", "Kai", "Lane",
];
const LAST_NAMES = [
  "Chen", "Patel", "Kim", "Silva", "Okafor", "Kowalski", "Nguyen", "Brown",
  "Moreno", "Ibrahim", "Schmidt", "Takahashi", "Dubois", "Ivanov", "Andersen",
];
const STATUSES: Row["status"][] = ["active", "pending", "archived"];

export function makeRows(count: number): Row[] {
  const rows: Row[] = new Array(count);
  const epoch = Date.UTC(2024, 0, 1);
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    rows[i] = {
      id: i,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      status: STATUSES[i % STATUSES.length],
      // Pseudo-amount with two decimals; deterministic so the grid stays stable
      // across re-renders.
      amount: Math.round(((i * 31) % 1000) * 100) / 100,
      // Space rows out by a minute each so the timestamps vary but mount cheap.
      createdAt: new Date(epoch + i * 60_000),
    };
  }
  return rows;
}

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATIC_COLUMNS: Column<Row>[] = [
  {
    key: "id",
    name: "ID",
    width: 70,
    cellClass: () => "playground-cell-muted",
  },
  {
    key: "name",
    name: "Name",
    width: 180,
  },
  {
    key: "email",
    name: "Email",
    width: 260,
  },
  {
    key: "status",
    name: "Status",
    width: 110,
    renderCell: ({ row }) => (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 10,
          fontSize: 12,
          background:
            row.status === "active"
              ? "#d4edda"
              : row.status === "pending"
                ? "#fff3cd"
                : "#e2e3e5",
          color:
            row.status === "active"
              ? "#155724"
              : row.status === "pending"
                ? "#856404"
                : "#383d41",
        }}
      >
        {row.status}
      </span>
    ),
  },
  {
    key: "amount",
    name: "Amount",
    width: 120,
    cellClass: () => "playground-cell-numeric",
    renderCell: ({ row }) => CURRENCY.format(row.amount),
  },
  {
    key: "createdAt",
    name: "Created",
    width: 200,
    renderCell: ({ row }) => DATE_FMT.format(row.createdAt),
  },
];

const ACTIONS_COLUMN: Column<Row> = {
  key: "actions",
  name: "Actions",
  width: 120,
  // Right-pinned: stays glued to the right edge while the rest of the grid
  // scrolls horizontally. Drag is force-disabled by `useCalculatedColumns`
  // for any pinned column, so leaving `draggable` unset is fine.
  frozen: "right",
  renderCell: ({ row }) => (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line no-alert
          alert(`Edit row ${row.id}`);
        }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // eslint-disable-next-line no-alert
          alert(`Delete row ${row.id}`);
        }}
      >
        Delete
      </button>
    </div>
  ),
};

/**
 * Build `count` columns — the first few are the richly-typed static columns
 * above, the rest are filler synthesized on demand so we can scale to 1000
 * without materializing `N*M` strings up front (would OOM at 1M × 1k).
 *
 * `frozenLeftCount` marks the first N data columns as `frozen: 'left'`.
 * `actionsRight`, when true, appends a right-pinned actions column so the
 * playground demonstrates both edges at once. Both flags layer on at build
 * time (not baked into `STATIC_COLUMNS`) so the playground toggles can flip
 * without rebuilding column identities.
 */
export function makeColumns(
  count: number,
  frozenLeftCount = 0,
  actionsRight = false,
): Column<Row>[] {
  const base =
    count <= STATIC_COLUMNS.length
      ? STATIC_COLUMNS.slice(0, count)
      : [...STATIC_COLUMNS];

  if (count > STATIC_COLUMNS.length) {
    const fillerCount = count - STATIC_COLUMNS.length;
    for (let i = 0; i < fillerCount; i++) {
      base.push({
        key: `extra-${i}`,
        name: `Extra ${i}`,
        width: 120,
        renderCell: ({ row }) => `R${row.id}·E${i}`,
      });
    }
  }

  const withFrozen =
    frozenLeftCount > 0
      ? base.map((col, idx) =>
          idx < Math.min(frozenLeftCount, base.length)
            ? { ...col, frozen: "left" as const }
            : col,
        )
      : base;

  return actionsRight ? [...withFrozen, ACTIONS_COLUMN] : withFrozen;
}
