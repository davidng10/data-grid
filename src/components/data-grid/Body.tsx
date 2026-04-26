import { flexRender, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

type Props<TData> = {
  table: Table<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  totalWidth: number;
};

export const Body = <TData,>({
  table,
  rowVirtualizer,
  columnVirtualizer,
  totalWidth,
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
        const cells = row.getVisibleCells();
        return (
          <div
            key={row.id}
            className="dg-row"
            style={{
              height: vr.size,
              width: totalWidth,
              transform: `translateY(${vr.start}px)`,
            }}
          >
            {virtualColumns.map((vc) => {
              const cell = cells[vc.index];
              if (!cell) return null;
              return (
                <div
                  key={cell.id}
                  className="dg-cell"
                  style={{
                    height: vr.size,
                    width: vc.size,
                    transform: `translateX(${vc.start}px)`,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
