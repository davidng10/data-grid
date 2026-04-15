import { memo, type MouseEvent } from "react";
import { flexRender, type Header } from "@tanstack/react-table";
import clsx from "clsx";
import type { DataGridColumnDef } from "../DataGrid.types";
import { useDataGridContext } from "../internal/DataGridContext";
import styles from "../DataGrid.module.css";

type HeaderCellProps<TRow> = {
  header: Header<TRow, unknown>;
};

function HeaderCellRender<TRow>({ header }: HeaderCellProps<TRow>) {
  const { featureFlags } = useDataGridContext();
  const size = header.getSize();

  if (header.isPlaceholder) {
    return (
      <div
        className={styles.headerCell}
        style={{ width: size, minWidth: size }}
        role="columnheader"
      />
    );
  }

  const meta = header.column.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  const dgColumn = meta?.dataGridColumn;
  const columnAllowsSort =
    dgColumn?.meta?.sortable === undefined ? true : dgColumn.meta.sortable;
  const sortable = featureFlags.sorting && columnAllowsSort;
  const sortDir = header.column.getIsSorted();

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!sortable) return;
    e.preventDefault();
    const current = header.column.getIsSorted();
    if (current === false) {
      header.column.toggleSorting(false, false);
    } else if (current === "asc") {
      header.column.toggleSorting(true, false);
    } else {
      header.column.clearSorting();
    }
  };

  return (
    <div
      className={clsx(
        styles.headerCell,
        sortable && styles.headerCellSortable,
      )}
      style={{ width: size, minWidth: size }}
      role="columnheader"
      aria-sort={
        sortDir === "asc"
          ? "ascending"
          : sortDir === "desc"
            ? "descending"
            : "none"
      }
      onClick={sortable ? handleClick : undefined}
    >
      <span className={styles.headerLabel}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      {sortDir !== false && (
        <span className={styles.sortIndicator} aria-hidden>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
    </div>
  );
}

export const HeaderCell = memo(HeaderCellRender) as typeof HeaderCellRender;
