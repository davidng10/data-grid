import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ColumnConfigState,
  ColumnPinningState,
} from "../components/DataGrid/DataGrid.types";

export type UseLocalStorageColumnConfigOptions = {
  maxVisibleColumns?: number;
  fixedVisibleColumnIds?: string[];
  fixedPins?: { left?: string[]; right?: string[] };
  onWarn?: (message: string) => void;
};

const SCHEMA_VERSION = 1 as const;
const DEFAULT_MAX_VISIBLE = 40;

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

type ResolvedOptions = {
  maxVisibleColumns: number;
  fixedVisibleColumnIds: string[];
  fixedPinsLeft: string[];
  fixedPinsRight: string[];
  warn: (message: string) => void;
};

function resolveOptions(
  options: UseLocalStorageColumnConfigOptions | undefined,
): ResolvedOptions {
  const warnFn = options?.onWarn ?? ((message: string) => console.warn(message));
  return {
    maxVisibleColumns: options?.maxVisibleColumns ?? DEFAULT_MAX_VISIBLE,
    fixedVisibleColumnIds: options?.fixedVisibleColumnIds ?? [],
    fixedPinsLeft: options?.fixedPins?.left ?? [],
    fixedPinsRight: options?.fixedPins?.right ?? [],
    warn: warnFn,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function sanitizeVisibility(
  raw: unknown,
  known: Set<string>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (known.size > 0 && !known.has(id)) continue;
    out[id] = Boolean(v);
  }
  return out;
}

function sanitizeSizing(
  raw: unknown,
  known: Set<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    if (known.size > 0 && !known.has(id)) continue;
    out[id] = v;
  }
  return out;
}

function sanitizePinning(
  raw: unknown,
  known: Set<string>,
  fixedLeft: string[],
  fixedRight: string[],
): ColumnPinningState {
  const rawPin = (raw && typeof raw === "object" ? raw : {}) as {
    left?: unknown;
    right?: unknown;
  };

  const filterKnown = (arr: unknown): string[] =>
    isStringArray(arr)
      ? arr.filter((id) => known.size === 0 || known.has(id))
      : [];

  let left = filterKnown(rawPin.left).filter(
    (id) => !fixedLeft.includes(id) && !fixedRight.includes(id),
  );
  let right = filterKnown(rawPin.right).filter(
    (id) => !fixedLeft.includes(id) && !fixedRight.includes(id),
  );

  left = [...fixedLeft, ...left];
  right = [...right, ...fixedRight];

  return { left, right };
}

function applyVisibilityCaps(
  visibility: Record<string, boolean>,
  order: string[],
  opts: ResolvedOptions,
): Record<string, boolean> {
  const out = { ...visibility };

  // Force fixed-visible ids on.
  for (const id of opts.fixedVisibleColumnIds) out[id] = true;

  const trueIds = Object.entries(out)
    .filter(([, v]) => v)
    .map(([id]) => id);

  if (trueIds.length <= opts.maxVisibleColumns) return out;

  opts.warn(
    `Column config exceeds max visible (${opts.maxVisibleColumns}); trimming extras.`,
  );

  const fixed = new Set(opts.fixedVisibleColumnIds);
  const keep = new Set<string>(fixed);

  // Preserve by columnOrder priority, then any unordered survivors.
  for (const id of order) {
    if (keep.size >= opts.maxVisibleColumns) break;
    if (out[id]) keep.add(id);
  }
  if (keep.size < opts.maxVisibleColumns) {
    for (const id of trueIds) {
      if (keep.size >= opts.maxVisibleColumns) break;
      keep.add(id);
    }
  }

  for (const id of trueIds) {
    if (!keep.has(id)) out[id] = false;
  }
  return out;
}

function validate(
  raw: unknown,
  opts: ResolvedOptions,
): ColumnConfigState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const r = raw as Partial<ColumnConfigState>;
  if (r.schemaVersion !== SCHEMA_VERSION) return EMPTY_STATE;

  const columnOrder = isStringArray(r.columnOrder) ? r.columnOrder : [];
  const known = new Set(columnOrder);

  const visibility = sanitizeVisibility(r.columnVisibility, known);
  const columnVisibility = applyVisibilityCaps(visibility, columnOrder, opts);

  const columnSizing = sanitizeSizing(r.columnSizing, known);

  const columnPinning = sanitizePinning(
    r.columnPinning,
    known,
    opts.fixedPinsLeft,
    opts.fixedPinsRight,
  );

  return {
    columnVisibility,
    columnOrder,
    columnSizing,
    columnPinning,
    schemaVersion: SCHEMA_VERSION,
  };
}

function readInitial(
  key: string,
  opts: ResolvedOptions,
): ColumnConfigState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_STATE;
    return validate(JSON.parse(raw), opts);
  } catch {
    return EMPTY_STATE;
  }
}

export function useLocalStorageColumnConfig(
  tableInstanceId: string,
  options?: UseLocalStorageColumnConfigOptions,
): [ColumnConfigState, (next: ColumnConfigState) => void] {
  const resolved = resolveOptions(options);
  const resolvedRef = useRef(resolved);
  useEffect(() => {
    resolvedRef.current = resolved;
  });

  const key = buildKey(tableInstanceId);

  const [state, setStateInternal] = useState<ColumnConfigState>(() =>
    readInitial(key, resolved),
  );

  const setState = useCallback(
    (next: ColumnConfigState) => {
      const validated = validate(next, resolvedRef.current);
      setStateInternal(validated);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(validated));
        }
      } catch {
        resolvedRef.current.warn(
          "Failed to persist column config to localStorage",
        );
      }
    },
    [key],
  );

  return [state, setState];
}
