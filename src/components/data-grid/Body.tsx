import { flexRender, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

type Props<TData> = {
  table: Table<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  totalWidth: number;
  leftTotalWidth: number;
};

export const Body = <TData,>({
  table,
  rowVirtualizer,
  columnVirtualizer,
  totalWidth,
  leftTotalWidth,
}: Props<TData>) => {
  const rows = table.getRowModel().rows;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  return (
    <div
      className="dg-body"
      style={{
        height: rowVirtualizer.getTotalSize(),
        width: totalWidth,
      }}
    >
      {virtualRows.map((vr) => {
        const row = rows[vr.index];
        if (!row) return null;
        const leftCells = row.getLeftVisibleCells();
        const centerCells = row.getCenterVisibleCells();
        const rightCells = row.getRightVisibleCells();
        const lastLeft = leftCells.length - 1;
        return (
          // Row uses transform: translateY for vertical placement; sticky cells
          // inside transformed parents work in modern Safari but were buggy
          // historically — if regressions appear, fall back to top: vr.start.
          <div
            key={row.id}
            className="dg-row"
            style={{
              height: vr.size,
              width: totalWidth,
              transform: `translateY(${vr.start}px)`,
            }}
          >
            {leftCells.map((cell, idx) => (
              <div
                key={cell.id}
                className={
                  idx === lastLeft
                    ? "dg-cell dg-pinned-left dg-pinned-left-last"
                    : "dg-cell dg-pinned-left"
                }
                style={{
                  height: vr.size,
                  width: cell.column.getSize(),
                  left: cell.column.getStart("left"),
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
            {virtualColumns.map((vc) => {
              const cell = centerCells[vc.index];
              if (!cell) return null;
              return (
                <div
                  key={cell.id}
                  className="dg-cell"
                  style={{
                    height: vr.size,
                    width: vc.size,
                    transform: `translateX(${leftTotalWidth + vc.start}px)`,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              );
            })}
            {rightCells.map((cell, idx) => (
              <div
                key={cell.id}
                className={
                  idx === 0
                    ? "dg-cell dg-pinned-right dg-pinned-right-first"
                    : "dg-cell dg-pinned-right"
                }
                style={{
                  height: vr.size,
                  width: cell.column.getSize(),
                  right: cell.column.getAfter("right"),
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
