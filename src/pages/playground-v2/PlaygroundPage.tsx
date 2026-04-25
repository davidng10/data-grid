import { useMemo, useState } from "react";

import { DataGrid } from "../../components/DataGridV2";
import type { Position } from "../../components/DataGridV2";
import { makeColumns, makeRows } from "./dataset";

import type { Row } from "./dataset";

type DatasetPreset = "dev" | "profiler";

const PRESETS: Record<
  DatasetPreset,
  { readonly rows: number; readonly cols: number; readonly label: string }
> = {
  dev: { rows: 10_000, cols: 30, label: "10k × 30 (dev)" },
  profiler: { rows: 1_000_000, cols: 1_000, label: "1M × 1000 (profiler)" },
};

const FROZEN_COUNT = 3;

export function PlaygroundPageV2() {
  const [preset, setPreset] = useState<DatasetPreset>("dev");
  const [frozenEnabled, setFrozenEnabled] = useState(true);
  const [actionsEnabled, setActionsEnabled] = useState(true);
  // Active position is owned by the grid; we mirror it here for debug
  // display via `onCellKeyDown` + `onCellClick`. When layer 10 lands,
  // `onActivePositionChange` will replace this glue.
  const [debugPosition, setDebugPosition] = useState<Position | null>(null);
  const { rows: rowCount, cols: colCount } = PRESETS[preset];

  const rows = useMemo(() => makeRows(rowCount), [rowCount]);
  const columns = useMemo(
    () =>
      makeColumns(
        colCount,
        frozenEnabled ? FROZEN_COUNT : 0,
        actionsEnabled,
      ),
    [colCount, frozenEnabled, actionsEnabled],
  );

  return (
    <div
      style={{
        height: "100vh",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box",
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

        <span
          style={{
            marginInlineStart: "auto",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            padding: "4px 8px",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
          aria-live="polite"
        >
          active:{" "}
          {debugPosition === null
            ? "—"
            : `idx=${debugPosition.idx}, rowIdx=${debugPosition.rowIdx}`}
        </span>
      </header>

      <fieldset>
        <legend>Features</legend>
        <label>
          <input
            type="checkbox"
            checked={frozenEnabled}
            onChange={(e) => setFrozenEnabled(e.target.checked)}
          />{" "}
          Left-pinned columns ({FROZEN_COUNT}) (layer 3)
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={actionsEnabled}
            onChange={(e) => setActionsEnabled(e.target.checked)}
          />{" "}
          Right-pinned actions column (layer 3)
        </label>
        <div style={{ marginBlockStart: 8, color: "#555", fontSize: 13 }}>
          <strong>Layer 4 active:</strong> click a cell or Tab into the grid,
          then use Arrow / Home / End / PageUp / PageDown / Tab. Tab at the
          last column exits the grid; Shift+Tab at the first column does the
          same on the inline-start side.
        </div>
      </fieldset>

      <fieldset style={{ opacity: 0.55 }} disabled>
        <legend>Features (enabled by later layers)</legend>
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
        style={{ flexGrow: 1 }}
        onCellClick={({ column, rowIdx }) =>
          setDebugPosition({ idx: column.idx, rowIdx })
        }
        onCellKeyDown={({ column, rowIdx }) =>
          setDebugPosition({ idx: column?.idx ?? -1, rowIdx })
        }
      />
    </div>
  );
}

function rowKeyGetter(row: Row) {
  return row.id;
}
