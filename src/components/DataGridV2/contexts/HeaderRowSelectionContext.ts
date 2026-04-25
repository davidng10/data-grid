import { createContext } from "react";

export interface HeaderRowSelectionContextValue {
  /** True when every selectable row is selected. */
  readonly isRowSelected: boolean;
  /** True when *some* (but not all) selectable rows are selected. */
  readonly isIndeterminate: boolean;
}

export interface SelectHeaderRowEvent {
  /** New checked state. The grid resolves "select all" / "deselect all" from this. */
  readonly checked: boolean;
}

/**
 * Header-row "select all" state. Provided once at the grid root; consumed by
 * the `SelectColumn` header cell via `useHeaderRowSelection`. Re-renders only
 * the header consumer, not data rows.
 */
export const HeaderRowSelectionContext = createContext<
  HeaderRowSelectionContextValue | undefined
>(undefined);
HeaderRowSelectionContext.displayName = "HeaderRowSelectionContext";

export const HeaderRowSelectionChangeContext = createContext<
  ((event: SelectHeaderRowEvent) => void) | undefined
>(undefined);
HeaderRowSelectionChangeContext.displayName = "HeaderRowSelectionChangeContext";
