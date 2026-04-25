import { memo } from "react";

import Cell from "./Cell";
import type { IterateOverViewportColumnsForRow } from "./hooks";
import type { CellMouseArgs, CellMouseEvent, Position } from "./types";
import { classnames } from "./utils";

import rowStyles from "./styles/Row.module.css";

interface RowProps<R> {
  readonly row: R;
  readonly rowIdx: number;
  /** 1-based grid row line where this row starts. */
  readonly gridRowStart: number;
  /** Stable iterator. Pass the row's `activeCellIdx` to drive `isCellActive`. */
  readonly iterateOverViewportColumnsForRow: IterateOverViewportColumnsForRow<R>;
  /**
   * Idx of the active cell *if* this row is the active row, else `-1`. Mismatch
   * here is the only reason a row's render diverges from peer rows; non-active
   * rows pass `-1` and stay shallow-equal across active-position changes.
   */
  readonly activeCellIdx: number;
  /**
   * `true` when this row sits outside the overscan window and is only being
   * rendered to keep the active cell mounted. Switches the column iterator
   * into single-cell mode.
   */
  readonly isOutsideViewport: boolean;
  readonly setActivePosition: (position: Position) => void;
  readonly onCellClick:
    | ((args: CellMouseArgs<R>, event: CellMouseEvent) => void)
    | null
    | undefined;
  readonly className?: string;
}

function Row<R>({
  row,
  rowIdx,
  gridRowStart,
  iterateOverViewportColumnsForRow,
  activeCellIdx,
  isOutsideViewport,
  setActivePosition,
  onCellClick,
  className,
}: RowProps<R>) {
  const ariaRowIndex = rowIdx + 2;

  const cells: React.ReactNode[] = [];
  for (const [column, isCellActive] of iterateOverViewportColumnsForRow(
    activeCellIdx,
    isOutsideViewport,
  )) {
    cells.push(
      <Cell
        key={column.key}
        column={column}
        row={row}
        rowIdx={rowIdx}
        isCellActive={isCellActive}
        setActivePosition={setActivePosition}
        onCellClick={onCellClick}
      />,
    );
  }

  return (
    <div
      role="row"
      aria-rowindex={ariaRowIndex}
      className={classnames(rowStyles.row, className)}
      style={{ gridRowStart }}
    >
      {cells}
    </div>
  );
}

const RowComponent = memo(Row) as <R>(props: RowProps<R>) => React.JSX.Element;

export default RowComponent;
