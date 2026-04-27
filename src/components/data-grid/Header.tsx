import { flexRender, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

type Props<TData> = {
  table: Table<TData>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  height: number;
  totalWidth: number;
  leftTotalWidth: number;
};

export const Header = <TData,>({
  table,
  columnVirtualizer,
  height,
  totalWidth,
  leftTotalWidth,
}: Props<TData>) => {
  const leftHeaderGroups = table.getLeftHeaderGroups();
  const centerHeaderGroups = table.getCenterHeaderGroups();
  const rightHeaderGroups = table.getRightHeaderGroups();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const groupCount = centerHeaderGroups.length;

  return (
    <div
      className="dg-header"
      style={{ height: height * groupCount, width: totalWidth }}
    >
      {centerHeaderGroups.map((centerGroup, gi) => {
        const leftHeaders = leftHeaderGroups[gi]?.headers ?? [];
        const centerHeaders = centerGroup.headers;
        const rightHeaders = rightHeaderGroups[gi]?.headers ?? [];
        const lastLeft = leftHeaders.length - 1;

        return (
          <div
            key={centerGroup.id}
            className="dg-header-row"
            style={{ height, width: totalWidth }}
          >
            {leftHeaders.map((header, idx) => (
              <div
                key={header.id}
                className={
                  idx === lastLeft
                    ? "dg-header-cell dg-pinned-left dg-pinned-left-last"
                    : "dg-header-cell dg-pinned-left"
                }
                style={{
                  height,
                  width: header.getSize(),
                  left: header.column.getStart("left"),
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </div>
            ))}
            {virtualColumns.map((vc) => {
              const header = centerHeaders[vc.index];
              if (!header) return null;
              return (
                <div
                  key={header.id}
                  className="dg-header-cell"
                  style={{
                    height,
                    width: vc.size,
                    transform: `translateX(${leftTotalWidth + vc.start}px)`,
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
            {rightHeaders.map((header, idx) => (
              <div
                key={header.id}
                className={
                  idx === 0
                    ? "dg-header-cell dg-pinned-right dg-pinned-right-first"
                    : "dg-header-cell dg-pinned-right"
                }
                style={{
                  height,
                  width: header.getSize(),
                  right: header.column.getAfter("right"),
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
