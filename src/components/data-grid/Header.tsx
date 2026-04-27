import type { HeaderGroup } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo } from "react";

import { HeaderCell } from "./HeaderCell";

type Props<TData> = {
  leftHeaderGroups: HeaderGroup<TData>[];
  centerHeaderGroups: HeaderGroup<TData>[];
  rightHeaderGroups: HeaderGroup<TData>[];
  virtualColumns: VirtualItem[];
  height: number;
  resizeEnabled: boolean;
};

// Memoized for the same reason as Body: width sits in a CSS var on the scroll
// container, so column-sizing commits don't change Header's props and the
// header cell iteration is skipped during drag.
const HeaderInner = <TData,>({
  leftHeaderGroups,
  centerHeaderGroups,
  rightHeaderGroups,
  virtualColumns,
  height,
  resizeEnabled,
}: Props<TData>) => {
  const groupCount = centerHeaderGroups.length;

  return (
    <div
      className="dg-header"
      style={{ height: height * groupCount, width: "var(--dg-total-width)" }}
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
            style={{ height, width: "var(--dg-total-width)" }}
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
                resizeEnabled={resizeEnabled}
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
                  resizeEnabled={resizeEnabled}
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
                resizeEnabled={resizeEnabled}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const Header = memo(HeaderInner) as typeof HeaderInner;
