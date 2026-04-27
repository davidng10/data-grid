import type { Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

import { HeaderCell } from "./HeaderCell";

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
              <HeaderCell
                key={header.id}
                header={header}
                height={height}
                className={
                  idx === lastLeft
                    ? "dg-header-cell dg-pinned-left dg-pinned-left-last"
                    : "dg-header-cell dg-pinned-left"
                }
                style={{ left: header.column.getStart("left") }}
              />
            ))}
            {virtualColumns.map((vc) => {
              const header = centerHeaders[vc.index];
              if (!header) return null;
              return (
                <HeaderCell
                  key={header.id}
                  header={header}
                  height={height}
                  className="dg-header-cell"
                  style={{
                    transform: `translateX(${leftTotalWidth + vc.start}px)`,
                  }}
                />
              );
            })}
            {rightHeaders.map((header, idx) => (
              <HeaderCell
                key={header.id}
                header={header}
                height={height}
                className={
                  idx === 0
                    ? "dg-header-cell dg-pinned-right dg-pinned-right-first"
                    : "dg-header-cell dg-pinned-right"
                }
                style={{ right: header.column.getAfter("right") }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};
