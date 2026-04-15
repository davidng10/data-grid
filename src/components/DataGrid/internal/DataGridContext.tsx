import { createContext, useContext } from "react";

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

export type DataGridContextValue = {
  cellExtras: Record<string, unknown>;
  featureFlags: DataGridFeatureFlags;
};

const DataGridContext = createContext<DataGridContextValue | null>(null);

export const DataGridContextProvider = DataGridContext.Provider;

export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext);
  if (ctx === null) {
    throw new Error(
      "useDataGridContext must be used inside a <DataGrid /> subtree.",
    );
  }
  return ctx;
}
