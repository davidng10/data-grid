import { useContext } from "react";

import { DataGridContext } from "./DataGridContext";

import type { DataGridContextValue } from "./DataGridContext";

export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext);
  if (ctx === null) {
    throw new Error(
      "useDataGridContext must be used inside a <DataGrid /> subtree.",
    );
  }
  return ctx;
}
