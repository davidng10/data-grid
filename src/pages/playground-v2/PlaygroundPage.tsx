import { useMemo, useState } from "react";

import { DataGrid } from "../../components/DataGridV2";
import { makeColumns, makeRows, type Row } from "./dataset";

type DatasetPreset = "dev" | "profiler";

const PRESETS: Record<
  DatasetPreset,
  { readonly rows: number; readonly cols: number; readonly label: string }
> = {
  dev: { rows: 10_000, cols: 30, label: "10k × 30 (dev)" },
  profiler: { rows: 1_000_000, cols: 1_000, label: "1M × 1000 (profiler)" },
};

export function PlaygroundPageV2() {
  const [preset, setPreset] = useState<DatasetPreset>("dev");
  const { rows: rowCount, cols: colCount } = PRESETS[preset];

  const rows = useMemo(() => makeRows(rowCount), [rowCount]);
  const columns = useMemo(() => makeColumns(colCount), [colCount]);

  return (
    <div
      style={{
        padding: 16,
        display: "grid",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>DataGridV2 Playground</h1>

        <label>
          Dataset:{" "}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DatasetPreset)}
          >
            {(Object.keys(PRESETS) as DatasetPreset[]).map((key) => (
              <option key={key} value={key}>
                {PRESETS[key].label}
              </option>
            ))}
          </select>
        </label>

        <span style={{ fontVariantNumeric: "tabular-nums", color: "#555" }}>
          {rows.length.toLocaleString()} rows ×{" "}
          {columns.length.toLocaleString()} cols
        </span>
      </header>

      {/* Placeholder controls — wired up per layer. Disabled until the
          corresponding layer lands so the regression surface is visible. */}
      <fieldset style={{ opacity: 0.55 }} disabled>
        <legend>Features (enabled by later layers)</legend>
        <label>
          <input type="checkbox" /> Frozen columns (layer 3)
        </label>{" "}
        <label>
          <input type="checkbox" /> Keyboard nav (layer 4)
        </label>{" "}
        <label>
          <input type="checkbox" /> Row selection (layer 5)
        </label>{" "}
        <label>
          <input type="checkbox" /> Column resize (layer 6)
        </label>{" "}
        <label>
          <input type="checkbox" /> Sort (layer 7)
        </label>{" "}
        <label>
          <input type="checkbox" /> Column reorder (layer 8)
        </label>{" "}
        <label>
          <input type="checkbox" /> Expansion (layer 9)
        </label>
      </fieldset>

      <DataGrid<Row>
        aria-label="DataGridV2 Playground Grid"
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        style={{ height: 500 }}
      />
    </div>
  );
}

function rowKeyGetter(row: Row) {
  return row.id;
}
