import { memo } from "react";

import Cell from "./Cell";
import type { CalculatedColumn } from "./types";
import { classnames } from "./utils";

import rowStyles from "./styles/Row.module.css";

interface RowProps<R> {
  readonly row: R;
  readonly rowIdx: number;
  /** 1-based grid row line where this row starts. */
  readonly gridRowStart: number;
  readonly columns: readonly CalculatedColumn<R>[];
  readonly className?: string;
}

function Row<R>({
  row,
  rowIdx,
  gridRowStart,
  columns,
  className,
}: RowProps<R>) {
  // aria-rowindex is 1-based; +2 = +1 for 1-based, +1 for the header row.
  const ariaRowIndex = rowIdx + 2;

  return (
    <div
      role="row"
      aria-rowindex={ariaRowIndex}
      className={classnames(rowStyles.row, className)}
      style={{ gridRowStart }}
    >
      {columns.map((column) => (
        <Cell
          key={column.key}
          column={column}
          row={row}
          rowIdx={rowIdx}
        />
      ))}
    </div>
  );
}

const RowComponent = memo(Row) as <R>(props: RowProps<R>) => React.JSX.Element;

export default RowComponent;
