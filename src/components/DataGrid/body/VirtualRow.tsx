import type { Row } from "@tanstack/react-table";
import { BodyCell } from "./BodyCell";
import type { CellRangeSelection } from "../DataGrid.types";
import { SELECT_COLUMN_ID } from "../selection/constants";
import { isCellInRange } from "../selection/useCellRangeSelection";
import styles from "../DataGrid.module.css";

type VirtualRowProps<TRow> = {
  row: Row<TRow>;
  top: number;
  height: number;
  totalWidth: number;
  // Live TanStack / range state read at this un-memoed boundary and forwarded
  // as explicit props to BodyCell (memoed). See plan/01 "Pattern — reading
  // TanStack state in memoed leaves".
  cellRangeSelection: CellRangeSelection | null;
  visualColumnIds: string[];
};

export function VirtualRow<TRow>({
  row,
  top,
  height,
  totalWidth,
  cellRangeSelection,
  visualColumnIds,
}: VirtualRowProps<TRow>) {
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
        const inRange = wireRangeHandlers
          ? isCellInRange(row.index, columnId, cellRangeSelection, visualColumnIds)
          : false;
        const isRangeAnchor =
          wireRangeHandlers &&
          cellRangeSelection !== null &&
          cellRangeSelection.anchor.rowIndex === row.index &&
          cellRangeSelection.anchor.columnId === columnId;
        const isRangeFocus =
          wireRangeHandlers &&
          cellRangeSelection !== null &&
          cellRangeSelection.focus.rowIndex === row.index &&
          cellRangeSelection.focus.columnId === columnId;
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
