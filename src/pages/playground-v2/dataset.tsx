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
    frozen: true,
    cellClass: () => "playground-cell-muted",
  },
  {
    key: "name",
    name: "Name",
    width: 180,
    frozen: true,
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

/**
 * Build `count` columns — the first few are the richly-typed static columns
 * above, the rest are filler synthesized on demand so we can scale to 1000
 * without materializing `N*M` strings up front (would OOM at 1M × 1k).
 */
export function makeColumns(count: number): Column<Row>[] {
  if (count <= STATIC_COLUMNS.length) {
    return STATIC_COLUMNS.slice(0, count);
  }
  const fillerCount = count - STATIC_COLUMNS.length;
  const filler: Column<Row>[] = new Array(fillerCount);
  for (let i = 0; i < fillerCount; i++) {
    filler[i] = {
      key: `extra-${i}`,
      name: `Extra ${i}`,
      width: 120,
      renderCell: ({ row }) => `R${row.id}·E${i}`,
    };
  }
  return [...STATIC_COLUMNS, ...filler];
}
