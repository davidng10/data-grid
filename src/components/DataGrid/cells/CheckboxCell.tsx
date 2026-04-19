import { memo } from "react";
import type { MouseEvent } from "react";

import { useDataGridContext } from "../useDataGridContext";
import type { DataGridCellProps } from "../DataGrid.types";

import styles from "../DataGrid.module.css";

function CheckboxCellRender(props: DataGridCellProps<unknown, unknown>) {
  const { toggleRow } = useDataGridContext();

  // Click rather than change so we can read shiftKey for range select.
  const onClick = (e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    toggleRow(props.rowIndex, props.rowId, e.shiftKey);
    e.preventDefault();
  };

  // mousedown shouldn't start a cell-range drag from the checkbox column —
  // the BodyCell mouse-handler path is already disabled for __select__, but
  // belt-and-braces here in case the cell is reused elsewhere.
  const onMouseDown = (e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };

  return (
    <input
      type="checkbox"
      className={styles.rowCheckbox}
      checked={props.isSelected}
      onClick={onClick}
      onChange={() => {}}
      onMouseDown={onMouseDown}
      aria-label="Select row"
    />
  );
}

export const CheckboxCell = memo(CheckboxCellRender);
