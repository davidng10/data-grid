import { createContext } from "react";

export interface RowSelectionContextValue {
  readonly isRowSelected: boolean;
  readonly isRowSelectionDisabled: boolean;
}

export interface SelectRowEvent {
  readonly rowIdx: number;
  readonly checked: boolean;
  readonly isShiftClick: boolean;
}

/**
 * Per-row selection state. Provided once per `Row` so toggling one row's
 * selection only invalidates that row's provider — adjacent rows pass shallow-
 * equal values and their consumers stay put. Consumed by the `SelectColumn`
 * cell via `useRowSelection`.
 *
 * Split from the change handler so consumers that only need to *fire*
 * selection changes (none today, but future renderers may) don't subscribe to
 * value updates.
 */
export const RowSelectionContext = createContext<
  RowSelectionContextValue | undefined
>(undefined);
RowSelectionContext.displayName = "RowSelectionContext";

export const RowSelectionChangeContext = createContext<
  ((event: SelectRowEvent) => void) | undefined
>(undefined);
RowSelectionChangeContext.displayName = "RowSelectionChangeContext";
