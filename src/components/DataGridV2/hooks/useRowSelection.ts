import { useContext } from "react";

import {
  HeaderRowSelectionChangeContext,
  HeaderRowSelectionContext,
  RowSelectionChangeContext,
  RowSelectionContext,
  type SelectHeaderRowEvent,
  type SelectRowEvent,
} from "../contexts";

interface UseRowSelectionResult {
  readonly isRowSelected: boolean;
  readonly isRowSelectionDisabled: boolean;
  readonly onRowSelectionChange: (event: SelectRowEvent) => void;
}

/**
 * Hook for consuming per-row selection state inside `column.renderCell`.
 * Combines the value + change contexts so a single call returns everything a
 * row-level selection control needs.
 *
 * Throws when used outside a row that has an active `RowSelectionContext`
 * provider — guards against accidental usage in `renderHeaderCell` (use
 * `useHeaderRowSelection` there) or outside the grid entirely.
 */
export function useRowSelection(): UseRowSelectionResult {
  const value = useContext(RowSelectionContext);
  const onChange = useContext(RowSelectionChangeContext);

  if (value === undefined || onChange === undefined) {
    throw new Error("useRowSelection must be called from a column.renderCell");
  }

  return {
    isRowSelected: value.isRowSelected,
    isRowSelectionDisabled: value.isRowSelectionDisabled,
    onRowSelectionChange: onChange,
  };
}

interface UseHeaderRowSelectionResult {
  readonly isRowSelected: boolean;
  readonly isIndeterminate: boolean;
  readonly onRowSelectionChange: (event: SelectHeaderRowEvent) => void;
}

/**
 * Header-row counterpart to {@link useRowSelection}. Consumed by the
 * `SelectColumn` header cell to drive the "select all" checkbox.
 */
export function useHeaderRowSelection(): UseHeaderRowSelectionResult {
  const value = useContext(HeaderRowSelectionContext);
  const onChange = useContext(HeaderRowSelectionChangeContext);

  if (value === undefined || onChange === undefined) {
    throw new Error(
      "useHeaderRowSelection must be called from a column.renderHeaderCell",
    );
  }

  return {
    isRowSelected: value.isRowSelected,
    isIndeterminate: value.isIndeterminate,
    onRowSelectionChange: onChange,
  };
}
