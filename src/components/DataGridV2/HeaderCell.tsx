import { memo } from "react";

import type { CalculatedColumn } from "./types";
import { classnames } from "./utils";

import cellStyles from "./styles/Cell.module.css";
import headerCellStyles from "./styles/HeaderCell.module.css";

interface HeaderCellProps<R> {
  readonly column: CalculatedColumn<R>;
}

function HeaderCell<R>({ column }: HeaderCellProps<R>) {
  return (
    <div
      role="columnheader"
      aria-colindex={column.idx + 1}
      tabIndex={-1}
      className={classnames(
        cellStyles.cell,
        headerCellStyles.headerCell,
        column.frozen && cellStyles.cellFrozen,
        column.frozen && headerCellStyles.headerCellFrozen,
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
    >
      {column.renderHeaderCell({
        column,
        sortDirection: undefined,
        tabIndex: -1,
      })}
    </div>
  );
}

const HeaderCellComponent = memo(HeaderCell) as <R>(
  props: HeaderCellProps<R>,
) => React.JSX.Element;

export default HeaderCellComponent;
