import { useCallback, useMemo, useState } from "react";

import { DataGrid } from "../../components/DataGridV2";
import type { Position, RowKey } from "../../components/DataGridV2";
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
  const [selectionEnabled, setSelectionEnabled] = useState(true);
  const [disabledEvensEnabled, setDisabledEvensEnabled] = useState(false);
  const [resizableEnabled, setResizableEnabled] = useState(true);
  // Active position is owned by the grid; we mirror it here for debug
  // display via `onCellKeyDown` + `onCellClick`. When layer 10 lands,
  // `onActivePositionChange` will replace this glue.
  const [debugPosition, setDebugPosition] = useState<Position | null>(null);
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<RowKey>>(
    () => new Set(),
  );
  const { rows: rowCount, cols: colCount } = PRESETS[preset];

  const rows = useMemo(() => makeRows(rowCount), [rowCount]);
  const columns = useMemo(
    () =>
      makeColumns(
        colCount,
        frozenEnabled ? FROZEN_COUNT : 0,
        actionsEnabled,
        resizableEnabled,
      ),
    [colCount, frozenEnabled, actionsEnabled, resizableEnabled],
  );

  // Memoised so the disabledCount in DataGrid only recomputes when the toggle
  // flips, not on every render. Demonstrates the non-trivial case where some
  // rows are non-selectable.
  const isRowSelectionDisabled = useCallback(
    (row: Row) => disabledEvensEnabled && row.id % 2 === 0,
    [disabledEvensEnabled],
  );

  // Reset selection when the dataset changes — `selectedRows` would otherwise
  // hold stale keys from the prior preset.
  const onPresetChange = useCallback((next: DatasetPreset) => {
    setPreset(next);
    setSelectedRows(new Set());
  }, []);

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
            onChange={(e) => onPresetChange(e.target.value as DatasetPreset)}
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
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            padding: "4px 8px",
            background: selectedRows.size > 0 ? "#d4edda" : "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 4,
          }}
          aria-live="polite"
        >
          selected: {selectedRows.size.toLocaleString()} of{" "}
          {rows.length.toLocaleString()}
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
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={selectionEnabled}
            onChange={(e) => {
              setSelectionEnabled(e.target.checked);
              if (!e.target.checked) setSelectedRows(new Set());
            }}
          />{" "}
          Row selection (layer 5)
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={disabledEvensEnabled}
            disabled={!selectionEnabled}
            onChange={(e) => setDisabledEvensEnabled(e.target.checked)}
          />{" "}
          Disable selection for even-id rows (layer 5)
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={resizableEnabled}
            onChange={(e) => setResizableEnabled(e.target.checked)}
          />{" "}
          Column resize (layer 6)
        </label>
        <div style={{ marginBlockStart: 8, color: "#555", fontSize: 13 }}>
          <strong>Layer 4:</strong> click a cell or Tab into the grid, then
          Arrow / Home / End / PageUp / PageDown / Tab to navigate. Tab at the
          last column exits.
          <br />
          <strong>Layer 5:</strong> click a row's checkbox to toggle. Shift +
          click another row's checkbox to range-select. With selection on,
          Shift + Space on an active data cell toggles its row.
          <br />
          <strong>Layer 6:</strong> hover a header's right edge for a
          col-resize cursor and drag. Resized widths persist across the
          dataset toggle (keyed by <code>column.key</code>). The{" "}
          <em>ID</em> column stays fixed; <em>Name</em> is clamped to{" "}
          <code>[80, 400]</code>.
        </div>
      </fieldset>

      <fieldset style={{ opacity: 0.55 }} disabled>
        <legend>Features (enabled by later layers)</legend>
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
        selectedRows={selectionEnabled ? selectedRows : undefined}
        onSelectedRowsChange={selectionEnabled ? setSelectedRows : undefined}
        isRowSelectionDisabled={
          selectionEnabled && disabledEvensEnabled
            ? isRowSelectionDisabled
            : undefined
        }
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
