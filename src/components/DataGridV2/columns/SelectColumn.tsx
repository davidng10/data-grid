// This file intentionally exports a `Column` config plus internal renderer
// components — the components and the config are tightly coupled and live
// together for clarity. Splitting just to satisfy the fast-refresh rule
// would obscure that intent. HMR for this column happens via the consuming
// page's reload, which is the same path every other column in the codebase
// takes.
/* oxlint-disable react/only-export-components */
import type { ChangeEvent } from "react";

import { useHeaderRowSelection, useRowSelection } from "../hooks";
import {
  SELECT_COLUMN_KEY,
  SPECIAL_COLUMN_WIDTH,
} from "../constants";
import type {
  Column,
  RenderCellProps,
  RenderHeaderCellProps,
} from "../types";

import selectColumnStyles from "../styles/SelectColumn.module.css";

interface CheckboxProps {
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly tabIndex: number;
  readonly "aria-label": string;
  readonly onChange: (checked: boolean, isShiftClick: boolean) => void;
}

function Checkbox({
  checked,
  indeterminate,
  disabled,
  tabIndex,
  "aria-label": ariaLabel,
  onChange,
}: CheckboxProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // `indeterminate` is set imperatively (not an HTML attribute) so onChange
    // is the only place we can pluck the originating shift-key state.
    const isShiftClick = (event.nativeEvent as MouseEvent).shiftKey === true;
    onChange(event.target.checked, isShiftClick);
  }

  return (
    <input
      type="checkbox"
      className={selectColumnStyles.checkbox}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el !== null) el.indeterminate = indeterminate === true;
      }}
      onChange={handleChange}
      onClick={(event) => {
        // The cell wrapper's mousedown already moves the active position; we
        // don't need the click to bubble further (and we definitely don't want
        // a consumer's `onCellClick` to fire as if the cell body was clicked).
        event.stopPropagation();
      }}
    />
  );
}

function SelectHeaderRenderer(_props: RenderHeaderCellProps<unknown>) {
  const { isRowSelected, isIndeterminate, onRowSelectionChange } =
    useHeaderRowSelection();

  return (
    <Checkbox
      aria-label="Select all"
      tabIndex={_props.tabIndex}
      checked={isRowSelected}
      indeterminate={isIndeterminate}
      onChange={(checked) => {
        // An indeterminate checkbox click reads as `checked: true` in the DOM,
        // but the conventional UX is "click clears the partial selection".
        onRowSelectionChange({ checked: isIndeterminate ? false : checked });
      }}
    />
  );
}

function SelectCellRenderer({ rowIdx, tabIndex }: RenderCellProps<unknown>) {
  const { isRowSelected, isRowSelectionDisabled, onRowSelectionChange } =
    useRowSelection();

  return (
    <Checkbox
      aria-label="Select row"
      tabIndex={tabIndex}
      checked={isRowSelected}
      disabled={isRowSelectionDisabled}
      onChange={(checked, isShiftClick) => {
        onRowSelectionChange({ rowIdx, checked, isShiftClick });
      }}
    />
  );
}

/**
 * Internal column injected at the inline-start edge whenever the consumer
 * supplies both `selectedRows` and `onSelectedRowsChange`. Always frozen left,
 * 40px wide, non-resizable / non-draggable / non-sortable. Renders a
 * "select all" checkbox in the header and a per-row checkbox below.
 *
 * Typed as `Column<unknown>` because it does not depend on the row shape — the
 * grid casts to `Column<R>` at injection time.
 */
export const SelectColumn: Column<unknown> = {
  key: SELECT_COLUMN_KEY,
  name: "",
  width: SPECIAL_COLUMN_WIDTH,
  minWidth: SPECIAL_COLUMN_WIDTH,
  maxWidth: SPECIAL_COLUMN_WIDTH,
  frozen: "left",
  resizable: false,
  draggable: false,
  sortable: false,
  cellClass: selectColumnStyles.cell,
  headerCellClass: selectColumnStyles.cell,
  renderHeaderCell: SelectHeaderRenderer,
  renderCell: SelectCellRenderer,
};
