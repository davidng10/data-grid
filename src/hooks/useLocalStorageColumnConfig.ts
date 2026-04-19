import { useCallback, useState } from "react";

import type { ColumnConfigState } from "../components/DataGrid";

const SCHEMA_VERSION = 1 as const;

const EMPTY_STATE: ColumnConfigState = {
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  columnPinning: { left: [], right: [] },
  schemaVersion: SCHEMA_VERSION,
};

function buildKey(tableInstanceId: string): string {
  return `datagrid:config:${tableInstanceId}:v1`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

// Structural validation only — no fixed-* / cap policy. useDataGrid reconciles
// semantics (unknown ids, fixed enforcement, caps) against the live column
// defs, so this layer just guarantees shape-safety and a matching schema
// version. Anything suspect → fall back to EMPTY_STATE and let reconcile seed.
function parseStored(raw: unknown): ColumnConfigState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const r = raw as Partial<ColumnConfigState>;
  if (r.schemaVersion !== SCHEMA_VERSION) return EMPTY_STATE;

  const columnOrder = isStringArray(r.columnOrder) ? r.columnOrder : [];

  const visibility: Record<string, boolean> = {};
  if (r.columnVisibility && typeof r.columnVisibility === "object") {
    for (const [id, v] of Object.entries(
      r.columnVisibility as Record<string, unknown>,
    )) {
      visibility[id] = Boolean(v);
    }
  }

  const sizing: Record<string, number> = {};
  if (r.columnSizing && typeof r.columnSizing === "object") {
    for (const [id, v] of Object.entries(
      r.columnSizing as Record<string, unknown>,
    )) {
      if (typeof v === "number" && !Number.isNaN(v)) sizing[id] = v;
    }
  }

  const rawPin = (r.columnPinning && typeof r.columnPinning === "object"
    ? r.columnPinning
    : {}) as { left?: unknown; right?: unknown };
  const columnPinning = {
    left: isStringArray(rawPin.left) ? rawPin.left : [],
    right: isStringArray(rawPin.right) ? rawPin.right : [],
  };

  return {
    columnVisibility: visibility,
    columnOrder,
    columnSizing: sizing,
    columnPinning,
    schemaVersion: SCHEMA_VERSION,
  };
}

function readInitial(key: string): ColumnConfigState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_STATE;
    return parseStored(JSON.parse(raw));
  } catch {
    return EMPTY_STATE;
  }
}

export function useLocalStorageColumnConfig(
  tableInstanceId: string,
): [ColumnConfigState, (next: ColumnConfigState) => void] {
  const key = buildKey(tableInstanceId);

  const [state, setStateInternal] = useState<ColumnConfigState>(() =>
    readInitial(key),
  );

  const setState = useCallback(
    (next: ColumnConfigState) => {
      setStateInternal(next);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        console.warn("Failed to persist column config to localStorage");
      }
    },
    [key],
  );

  return [state, setState];
}
