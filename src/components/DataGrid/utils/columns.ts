import type { ColumnDef } from "@tanstack/react-table";
import type { DataGridColumnDef } from "../types";

export function toTSColumns<TRow>(
  columns: DataGridColumnDef<TRow>[],
): ColumnDef<TRow>[] {
  return columns.map((col) => {
    const headerDef = col.header;
    return {
      id: col.id,
      header:
        typeof headerDef === "string" ? headerDef : (ctx) => headerDef(ctx),
      accessorFn: (row: TRow) => col.accessor(row),
      size: col.width ?? 160,
      minSize: col.minWidth ?? 60,
      maxSize: col.maxWidth ?? 800,
      enableSorting:
        col.meta?.sortable === undefined ? true : col.meta.sortable,
      meta: {
        dataGridColumn: col,
      },
    };
  });
}
