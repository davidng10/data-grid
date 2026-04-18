import { createContext, useContext } from "react";
import type { RowSelectionHeaderState } from "../selection/useRowSelection";

// Separate from DataGridContext so that row-selection state changes
// (which happen on every checkbox click) don't invalidate the context that
// BodyCell consumes — BodyCell stays memo-friendly. Only HeaderCheckbox
// subscribes here.
export type HeaderSelectionContextValue = {
  state: RowSelectionHeaderState;
  toggleAll: () => void;
};

const HeaderSelectionContext = createContext<HeaderSelectionContextValue | null>(
  null,
);

export const HeaderSelectionContextProvider = HeaderSelectionContext.Provider;

export function useHeaderSelectionContext(): HeaderSelectionContextValue | null {
  return useContext(HeaderSelectionContext);
}
