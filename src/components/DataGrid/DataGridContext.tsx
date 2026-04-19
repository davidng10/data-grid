import { createContext } from "react";
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

export type DataGridContextValue = {
  cellExtras: Record<string, unknown>;
  featureFlags: DataGridFeatureFlags;
  cellMouseHandlers: DataGridCellMouseHandlers;
  toggleRow: ToggleRowFn;
};

export const DataGridContext = createContext<DataGridContextValue | null>(null);
