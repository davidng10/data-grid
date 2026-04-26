import { useRef } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Body } from "./Body";
import { Header } from "./Header";
import {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
} from "./constants";
import { useGridVirtualizers } from "./useGridVirtualizers";
import type { DataGridProps } from "./types";
import "./DataGrid.css";

export const DataGrid = <TData,>({
  data,
  columns,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  className,
  style,
}: DataGridProps<TData>) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rowVirtualizer, columnVirtualizer } = useGridVirtualizers({
    scrollRef,
    table,
    rowCount: data.length,
    rowHeight,
    overscan,
  });

  const totalWidth = columnVirtualizer.getTotalSize();

  return (
    <div
      ref={scrollRef}
      className={className ? `dg-container ${className}` : "dg-container"}
      style={style}
    >
      <Header
        table={table}
        columnVirtualizer={columnVirtualizer}
        height={headerHeight}
        totalWidth={totalWidth}
      />
      <Body
        table={table}
        rowVirtualizer={rowVirtualizer}
        columnVirtualizer={columnVirtualizer}
        totalWidth={totalWidth}
      />
    </div>
  );
};
