import { useMemo, useState } from "react";

import {
  DataGrid,
  type ColumnDef,
  type ColumnPinningState,
} from "../components/data-grid";

const INITIAL_COLUMN_PINNING: ColumnPinningState = {
  left: ["id", "firstName"],
  right: ["joinedAt"],
};

type Row = Record<string, string | number>;

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "Dan",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
];
const LAST_NAMES = [
  "Lee",
  "Tan",
  "Smith",
  "Kim",
  "Patel",
  "Garcia",
  "Wong",
  "Singh",
];
const CITIES = ["Singapore", "Tokyo", "Berlin", "London", "NYC", "Sydney"];
const COUNTRIES = ["SG", "JP", "DE", "GB", "US", "AU"];

const BASE_COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "firstName", header: "First name", size: 140 },
  { accessorKey: "lastName", header: "Last name", size: 140 },
  { accessorKey: "email", header: "Email", size: 240 },
  { accessorKey: "age", header: "Age", size: 80 },
  { accessorKey: "city", header: "City", size: 160 },
  { accessorKey: "country", header: "Country", size: 100 },
  { accessorKey: "joinedAt", header: "Joined", size: 140 },
];

const buildColumns = (cols: number): ColumnDef<Row>[] => {
  if (cols <= BASE_COLUMNS.length) return BASE_COLUMNS.slice(0, cols);
  const extras: ColumnDef<Row>[] = [];
  for (let i = BASE_COLUMNS.length; i < cols; i++) {
    extras.push({
      accessorKey: `col_${i}`,
      header: `Column ${i + 1}`,
      size: 140,
    });
  }
  return [...BASE_COLUMNS, ...extras];
};

const buildData = (rows: number, cols: number): Row[] => {
  const data: Row[] = new Array(rows);
  for (let r = 0; r < rows; r++) {
    const row: Row = {
      id: r,
      firstName: FIRST_NAMES[r % FIRST_NAMES.length],
      lastName: LAST_NAMES[r % LAST_NAMES.length],
      email: `user${r}@example.com`,
      age: 20 + (r % 50),
      city: CITIES[r % CITIES.length],
      country: COUNTRIES[r % COUNTRIES.length],
      joinedAt: `202${r % 6}-${String((r % 12) + 1).padStart(2, "0")}-${String((r % 28) + 1).padStart(2, "0")}`,
    };
    for (let c = BASE_COLUMNS.length; c < cols; c++) {
      row[`col_${c}`] = `r${r}c${c}`;
    }
    data[r] = row;
  }
  return data;
};

const PRESETS = [
  { label: "10 × 5", rows: 100, cols: 5 },
  { label: "1k × 20", rows: 1_000, cols: 20 },
  { label: "10k × 50", rows: 10_000, cols: 50 },
  { label: "100k × 100", rows: 100_000, cols: 100 },
] as const;

const buttonStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  background: active ? "var(--accent)" : "transparent",
  color: active ? "#fff" : "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
});

export const Playground = () => {
  const [presetIdx, setPresetIdx] = useState(2);
  const [fixed, setFixed] = useState(false);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    INITIAL_COLUMN_PINNING,
  );
  const preset = PRESETS[presetIdx];

  const columns = useMemo(() => buildColumns(preset.cols), [preset.cols]);
  const data = useMemo(
    () => buildData(preset.rows, preset.cols),
    [preset.rows, preset.cols],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        gap: 12,
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPresetIdx(i)}
              style={buttonStyle(i === presetIdx)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={fixed}
            onChange={(e) => setFixed(e.target.checked)}
          />
          Fixed size (600 × 400)
        </label>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {preset.rows.toLocaleString()} rows × {preset.cols} cols
        </span>
      </div>

      {fixed ? (
        <div style={{ alignSelf: "flex-start" }}>
          <DataGrid
            data={data}
            columns={columns}
            columnPinning={columnPinning}
            onColumnPinningChange={setColumnPinning}
            style={{ width: 600, height: 400 }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <DataGrid
            data={data}
            columns={columns}
            columnPinning={columnPinning}
            onColumnPinningChange={setColumnPinning}
          />
        </div>
      )}
    </div>
  );
};
