import { createContext, useContext } from "react";

import type { MouseEvent } from "react";

export type DataGridFeatureFlags = {
  sorting: boolean;
  pinning: boolean;
  reorder: boolean;
  resize: boolean;
  columnVisibility: boolean;
  rowSelection: boolean;
  rangeSelection: boolean;
  inlineEdit: boolean;
};

// Stable per-grid mouse handlers for body cells. The grid passes these in via
// useMemo so consumers (BodyCell) get a stable identity — handler internals
// read the current range state via refs to avoid churning identity.
export type DataGridCellMouseHandlers = {
  onCellMouseDown: (
    rowIndex: number,
    columnId: string,
    e: MouseEvent<HTMLDivElement>,
  ) => void;
  onCellMouseEnter: (rowIndex: number, columnId: string) => void;
  onCellContextMenu: (
    rowIndex: number,
    columnId: string,
    e: MouseEvent<HTMLDivElement>,
  ) => void;
};

// Row-selection toggle. Stable identity — the grid wires it once. CheckboxCell
// in the injected __select__ column calls it; nothing else reads it.
export type ToggleRowFn = (
  rowIndex: number,
  rowId: string,
  shiftKey: boolean,
) => void;

// Config context: values that change rarely (feature flags) or opaquely
// featureFlags read from here and skip re-renders driven by
// handler-identity churn.
export type DataGridConfigValue = {
  featureFlags: DataGridFeatureFlags;
};

// Actions context: mouse handlers (stable by construction via refs) and
// toggleRow. Separated from config so a cell that reads actions doesn't also
// re-render on config changes — and vice versa.
export type DataGridActionsValue = {
  cellMouseHandlers: DataGridCellMouseHandlers;
  toggleRow: ToggleRowFn;
};

export const DataGridConfigContext = createContext<DataGridConfigValue | null>(
  null,
);

export const DataGridActionsContext =
  createContext<DataGridActionsValue | null>(null);

export function useDataGridConfig(): DataGridConfigValue {
  const ctx = useContext(DataGridConfigContext);
  if (ctx === null) {
    throw new Error(
      "useDataGridConfig must be used inside a <DataGrid /> subtree.",
    );
  }
  return ctx;
}

export function useDataGridActions(): DataGridActionsValue {
  const ctx = useContext(DataGridActionsContext);
  if (ctx === null) {
    throw new Error(
      "useDataGridActions must be used inside a <DataGrid /> subtree.",
    );
  }
  return ctx;
}
