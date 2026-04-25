import { memo, type MouseEvent } from "react";

import { useRovingTabIndex } from "./hooks";
import type {
  CalculatedColumn,
  CellMouseArgs,
  CellMouseEvent,
  Position,
} from "./types";
import { classnames, createCellEvent } from "./utils";

import cellStyles from "./styles/Cell.module.css";

interface CellProps<R> {
  readonly column: CalculatedColumn<R>;
  readonly row: R;
  readonly rowIdx: number;
  readonly isCellActive: boolean;
  /** Stable identity (`useLatestFunc`'d at the grid root). */
  readonly setActivePosition: (position: Position) => void;
  /** Stable identity (`useLatestFunc`'d at the grid root). May be null/undefined. */
  readonly onCellClick:
    | ((args: CellMouseArgs<R>, event: CellMouseEvent) => void)
    | null
    | undefined;
}

function Cell<R>({
  column,
  row,
  rowIdx,
  isCellActive,
  setActivePosition,
  onCellClick,
}: CellProps<R>) {
  const { tabIndex, childTabIndex, onFocus } = useRovingTabIndex(isCellActive);
  const { cellClass, renderCell } = column;
  const resolvedCellClass =
    typeof cellClass === "function" ? cellClass(row) : cellClass;

  function selectCell() {
    setActivePosition({ idx: column.idx, rowIdx });
  }

  function handleMouseDown() {
    // Mousedown selects the cell, but we deliberately do not call
    // setPositionToFocus — the browser focuses the clicked element natively,
    // and asking React to focus it again would steal focus from any inner
    // interactive element (e.g. a button inside renderCell).
    selectCell();
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (onCellClick == null) return;
    const cellEvent = createCellEvent(event);
    onCellClick(
      { column, row, rowIdx, setActivePosition: selectCell },
      cellEvent,
    );
  }

  return (
    <div
      role="gridcell"
      aria-colindex={column.idx + 1}
      aria-selected={isCellActive}
      tabIndex={tabIndex}
      className={classnames(
        cellStyles.cell,
        column.frozen && cellStyles.cellFrozen,
        isCellActive && cellStyles.cellActive,
        resolvedCellClass,
      )}
      style={{
        gridColumnStart: column.idx + 1,
        insetInlineStart:
          column.frozen === "left"
            ? `var(--rdg-frozen-left-${column.idx})`
            : undefined,
        insetInlineEnd:
          column.frozen === "right"
            ? `var(--rdg-frozen-right-${column.idx})`
            : undefined,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={onFocus}
    >
      {renderCell({ column, row, rowIdx, tabIndex: childTabIndex })}
    </div>
  );
}

const CellComponent = memo(Cell) as <R>(
  props: CellProps<R>,
) => React.JSX.Element;

export default CellComponent;
