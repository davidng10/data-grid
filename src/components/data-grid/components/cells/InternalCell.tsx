import { flexRender, type Cell as TableCell } from "@tanstack/react-table";
import { memo, type CSSProperties } from "react";

type CellProps<TData> = {
  cell: TableCell<TData, unknown>;
  height: number;
  className: string;
};

/**
 * Internal cell component used in data grid renders, not meant
 * for column cell render uses.
 */
const CellInner = <TData,>({ cell, height, className }: CellProps<TData>) => {
  const id = cell.column.id;
  const pinned = cell.column.getIsPinned();

  let style: CSSProperties;
  if (pinned === "left") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      left: `var(--dg-col-${id}-pinned-left)`,
    };
  } else if (pinned === "right") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      right: `var(--dg-col-${id}-pinned-right)`,
    };
  } else {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      transform: `translateX(calc(var(--dg-left-total) + var(--dg-col-${id}-start)))`,
    };
  }

  return (
    <div className={className} style={style}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
};

export const Cell = memo(CellInner) as typeof CellInner;
