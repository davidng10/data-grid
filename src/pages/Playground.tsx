import { useEffect, useMemo, useState } from "react";

import {
  DataGrid,
  NumberCell,
  SelectCell,
  TextCell,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
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

const CITY_OPTIONS = CITIES.map((c) => ({ label: c, value: c }));
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ label: c, value: c }));

const BASE_COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  {
    accessorKey: "firstName",
    header: "First name (editable)",
    size: 180,
    editable: true,
    editCell: (context) => <TextCell context={context} />,
  },
  {
    accessorKey: "lastName",
    header: "Last name (editable)",
    size: 180,
    editable: true,
    editCell: (context) => <TextCell context={context} />,
  },
  {
    accessorKey: "email",
    header: "Email (async ~600ms)",
    size: 240,
    editable: true,
    editCell: (context) => <TextCell context={context} />,
  },
  {
    accessorKey: "age",
    header: "Age (editable)",
    size: 120,
    editable: true,
    editCell: (context) => (
      <NumberCell context={context} min={0} max={120} />
    ),
  },
  {
    accessorKey: "city",
    header: "City (editable)",
    size: 160,
    editable: true,
    editCell: (context) => (
      <SelectCell context={context} options={CITY_OPTIONS} />
    ),
  },
  {
    accessorKey: "country",
    header: "Country (async, 30% fail)",
    size: 180,
    editable: true,
    editCell: (context) => (
      <SelectCell context={context} options={COUNTRY_OPTIONS} />
    ),
  },
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
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const preset = PRESETS[presetIdx];

  const columns = useMemo(() => buildColumns(preset.cols), [preset.cols]);
  const [data, setData] = useState<Row[]>(() =>
    buildData(preset.rows, preset.cols),
  );
  useEffect(() => {
    setData(buildData(preset.rows, preset.cols));
  }, [preset.rows, preset.cols]);

  const onCellChange = useMemo(
    () => (rowIndex: number, columnId: string, value: unknown) => {
      // Optimistic write. Capture prevValue from inside the setter so we
      // don't close over a stale `data` ref.
      let prevValue: string | number | undefined;
      console.log("onCellChange", rowIndex, columnId, value);
      setData((prev) => {
        prevValue = prev[rowIndex]?.[columnId];
        return prev.map((r, i) =>
          i === rowIndex ? { ...r, [columnId]: value as string | number } : r,
        );
      });

      const isAsync = columnId === "email" || columnId === "country";
      if (!isAsync) return;

      const shouldFail = columnId === "country" && Math.random() < 0.3;
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (shouldFail) {
            // Parent-managed revert: restore the captured prevValue.
            setData((prev) =>
              prev.map((r, i) =>
                i === rowIndex && prevValue !== undefined
                  ? { ...r, [columnId]: prevValue }
                  : r,
              ),
            );
            reject(new Error("simulated server failure"));
          } else {
            resolve();
          }
        }, 600);
      });
    },
    [],
  );

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    columns.map((c) => c.id ?? (c as { accessorKey: string }).accessorKey),
  );
  // Reset order when the column set changes (preset switch). Otherwise the
  // controlled order would be referring to ids that no longer exist.
  useEffect(() => {
    setColumnOrder(
      columns.map((c) => c.id ?? (c as { accessorKey: string }).accessorKey),
    );
  }, [columns]);

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
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            columnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            onCellChange={onCellChange}
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
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            columnOrder={columnOrder}
            onColumnOrderChange={setColumnOrder}
            onCellChange={onCellChange}
          />
        </div>
      )}
    </div>
  );
};
