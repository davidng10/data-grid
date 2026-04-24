import { memo } from "react";

import type { CalculatedColumn } from "./types";
import { classnames } from "./utils";

import cellStyles from "./styles/Cell.module.css";

interface CellProps<R> {
  readonly column: CalculatedColumn<R>;
  readonly row: R;
  readonly rowIdx: number;
}

function Cell<R>({ column, row, rowIdx }: CellProps<R>) {
  const { cellClass, renderCell } = column;
  const resolvedCellClass =
    typeof cellClass === "function" ? cellClass(row) : cellClass;

  return (
    <div
      role="gridcell"
      aria-colindex={column.idx + 1}
      tabIndex={-1}
      className={classnames(
        cellStyles.cell,
        column.frozen && cellStyles.cellFrozen,
        resolvedCellClass,
      )}
      style={{ gridColumnStart: column.idx + 1 }}
    >
      {renderCell({ column, row, rowIdx, tabIndex: -1 })}
    </div>
  );
}

// Cast preserves the generic signature that memo strips.
const CellComponent = memo(Cell) as <R>(
  props: CellProps<R>,
) => React.JSX.Element;

export default CellComponent;
