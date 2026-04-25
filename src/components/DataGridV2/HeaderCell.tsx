import { memo } from "react";

import { useRovingTabIndex } from "./hooks";
import type { CalculatedColumn, Position } from "./types";
import { classnames } from "./utils";

import cellStyles from "./styles/Cell.module.css";
import headerCellStyles from "./styles/HeaderCell.module.css";

interface HeaderCellProps<R> {
  readonly column: CalculatedColumn<R>;
  readonly isCellActive: boolean;
  /**
   * When the grid has no active position, the first header cell elevates its
   * tab-index so a Tab into the grid lands somewhere interactive. The first
   * focus then sets the active position to this cell.
   */
  readonly shouldFocusGrid: boolean;
  readonly setActivePosition: (position: Position) => void;
}

function HeaderCell<R>({
  column,
  isCellActive,
  shouldFocusGrid,
  setActivePosition,
}: HeaderCellProps<R>) {
  const { tabIndex, childTabIndex, onFocus } = useRovingTabIndex(
    shouldFocusGrid || isCellActive,
  );

  function selectHeaderCell() {
    setActivePosition({ idx: column.idx, rowIdx: -1 });
  }

  function handleFocus(event: React.FocusEvent<HTMLDivElement>) {
    onFocus?.(event);
    if (shouldFocusGrid) {
      // First Tab into the grid lands here — promote it to the active cell.
      selectHeaderCell();
    }
  }

  return (
    <div
      role="columnheader"
      aria-colindex={column.idx + 1}
      aria-selected={isCellActive}
      tabIndex={tabIndex}
      className={classnames(
        cellStyles.cell,
        headerCellStyles.headerCell,
        column.frozen && cellStyles.cellFrozen,
        column.frozen && headerCellStyles.headerCellFrozen,
        isCellActive && cellStyles.cellActive,
        column.headerCellClass,
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
      onMouseDown={selectHeaderCell}
      onFocus={handleFocus}
    >
      {column.renderHeaderCell({
        column,
        sortDirection: undefined,
        tabIndex: childTabIndex,
      })}
    </div>
  );
}

const HeaderCellComponent = memo(HeaderCell) as <R>(
  props: HeaderCellProps<R>,
) => React.JSX.Element;

export default HeaderCellComponent;
