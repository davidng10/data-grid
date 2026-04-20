import { memo } from "react";

import { SELECT_COLUMN_ID } from "../../constants";
import { BodyCell } from "./BodyCell";

import type { Row } from "@tanstack/react-table";

import styles from "../../DataGrid.module.css";

// Per-row slice of the range state, computed by DataGrid. `null` when the row
// is outside the range's row span — React.memo then bails via pointer compare.
// anchorColumnId / focusColumnId are only set on the anchor and focus rows
// respectively; in-between rows hold null for both.
export type RangeRowState = {
  inRangeColumnIds: Set<string>;
  anchorColumnId: string | null;
  focusColumnId: string | null;
};

type BodyRowProps<TRow> = {
  row: Row<TRow>;
  top: number;
  height: number;
  totalWidth: number;
  rangeForRow: RangeRowState | null;
};

function BodyRowRender<TRow>({
  row,
  top,
  height,
  totalWidth,
  rangeForRow,
}: BodyRowProps<TRow>) {
  const cells = row.getVisibleCells();
  const isSelected = row.getIsSelected();
  return (
    <div
      className={styles.bodyRow}
      style={{ top, height, width: totalWidth, minWidth: totalWidth }}
      role="row"
      data-row-id={row.id}
    >
      {cells.map((cell) => {
        const pinned = cell.column.getIsPinned();
        const columnId = cell.column.id;
        const isSelectColumn = columnId === SELECT_COLUMN_ID;
        // The __select__ column opts out of range-selection mouse handlers so
        // clicking a checkbox doesn't start a drag / clear the current range.
        const wireRangeHandlers = !isSelectColumn;
        const inRange =
          wireRangeHandlers && rangeForRow !== null
            ? rangeForRow.inRangeColumnIds.has(columnId)
            : false;
        const isRangeAnchor =
          wireRangeHandlers &&
          rangeForRow !== null &&
          rangeForRow.anchorColumnId === columnId;
        const isRangeFocus =
          wireRangeHandlers &&
          rangeForRow !== null &&
          rangeForRow.focusColumnId === columnId;
        return (
          <BodyCell
            key={cell.id}
            cell={cell}
            rowIndex={row.index}
            rowId={row.id}
            size={cell.column.getSize()}
            pinned={pinned}
            pinLeft={pinned === "left" ? cell.column.getStart("left") : 0}
            pinRight={pinned === "right" ? cell.column.getAfter("right") : 0}
            isInRange={inRange}
            isRangeAnchor={isRangeAnchor}
            isRangeFocus={isRangeFocus}
            isSelected={isSelected}
            wireRangeHandlers={wireRangeHandlers}
          />
        );
      })}
    </div>
  );
}

export const BodyRow = memo(BodyRowRender) as typeof BodyRowRender;
