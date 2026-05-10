import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { HeaderGroup } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { memo } from "react";

import { GRID_Z_INDEX } from "../../constants";
import { HeaderCell } from "./HeaderCell";
import { SortableHeaderCell } from "./SortableHeaderCell";

type Props<TData> = {
  leftHeaderGroups: HeaderGroup<TData>[];
  centerHeaderGroups: HeaderGroup<TData>[];
  rightHeaderGroups: HeaderGroup<TData>[];
  virtualColumns: VirtualItem[];
  height: number;
  resizeEnabled: boolean;
  reorderEnabled: boolean;
  centerColumnIds: string[];
};

const HeaderInner = <TData,>({
  leftHeaderGroups,
  centerHeaderGroups,
  rightHeaderGroups,
  virtualColumns,
  height,
  resizeEnabled,
  reorderEnabled,
  centerColumnIds,
}: Props<TData>) => {
  const groupCount = centerHeaderGroups.length;

  return (
    <div
      className="dg-header"
      style={{
        height: height * groupCount,
        width: "var(--dg-total-width)",
        zIndex: GRID_Z_INDEX.header,
      }}
    >
      {centerHeaderGroups.map((centerGroup, gi) => {
        const leftHeaders = leftHeaderGroups[gi]?.headers ?? [];
        const centerHeaders = centerGroup.headers;
        const rightHeaders = rightHeaderGroups[gi]?.headers ?? [];
        const lastLeft = leftHeaders.length - 1;

        const centerNodes = virtualColumns.map((virtualColumn) => {
          const header = centerHeaders[virtualColumn.index];
          if (!header) return null;
          return reorderEnabled ? (
            <SortableHeaderCell
              key={header.id}
              header={header}
              height={height}
              className="dg-header-cell"
              resizeEnabled={resizeEnabled}
            />
          ) : (
            <HeaderCell
              key={header.id}
              header={header}
              height={height}
              className="dg-header-cell"
              resizeEnabled={resizeEnabled}
            />
          );
        });

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
            {reorderEnabled ? (
              <SortableContext
                items={centerColumnIds}
                strategy={horizontalListSortingStrategy}
              >
                {centerNodes}
              </SortableContext>
            ) : (
              centerNodes
            )}
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
