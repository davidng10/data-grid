import { useVirtualizer } from "@tanstack/react-virtual";
import type { Table } from "@tanstack/react-table";
import type { RefObject } from "react";

type Args<TData> = {
  scrollRef: RefObject<HTMLDivElement | null>;
  table: Table<TData>;
  rowCount: number;
  rowHeight: number;
  overscan: number;
};

export const useGridVirtualizers = <TData,>({
  scrollRef,
  table,
  rowCount,
  rowHeight,
  overscan,
}: Args<TData>) => {
  const visibleColumns = table.getVisibleLeafColumns();

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: visibleColumns.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    overscan,
  });

  return { rowVirtualizer, columnVirtualizer };
};
