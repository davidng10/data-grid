import { useVirtualizer } from "@tanstack/react-virtual";
import type { Table } from "@tanstack/react-table";
import type { RefObject } from "react";

type Args<TData> = {
  scrollRef: RefObject<HTMLDivElement | null>;
  table: Table<TData>;
  rowCount: number;
  rowHeight: number;
  columnOverscan: number;
  rowOverscan: number;
};

export const useGridVirtualizers = <TData,>({
  scrollRef,
  table,
  rowCount,
  rowHeight,
  rowOverscan,
  columnOverscan,
}: Args<TData>) => {
  // Only the center zone is column-virtualized; left/right pinned columns are
  // always rendered as sticky cells in Header/Body.
  const visibleColumns = table.getCenterVisibleLeafColumns();

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: rowOverscan,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: visibleColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    overscan: columnOverscan,
  });

  return { rowVirtualizer, columnVirtualizer };
};
