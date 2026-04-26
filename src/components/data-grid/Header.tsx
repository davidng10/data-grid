import { flexRender, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

type Props<TData> = {
  table: Table<TData>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  height: number;
  totalWidth: number;
};

export const Header = <TData,>({
  table,
  columnVirtualizer,
  height,
  totalWidth,
}: Props<TData>) => {
  const headerGroups = table.getHeaderGroups();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  return (
    <div className="dg-header" style={{ height, width: totalWidth }}>
      {headerGroups.map((headerGroup) => (
        <div
          key={headerGroup.id}
          className="dg-header-row"
          style={{ height, width: totalWidth }}
        >
          {virtualColumns.map((vc) => {
            const header = headerGroup.headers[vc.index];
            if (!header) return null;
            return (
              <div
                key={header.id}
                className="dg-header-cell"
                style={{
                  height,
                  width: vc.size,
                  transform: `translateX(${vc.start}px)`,
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
