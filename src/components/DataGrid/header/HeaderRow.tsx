import { memo } from "react";
import type { Header } from "@tanstack/react-table";
import { HeaderCell } from "./HeaderCell";
import { ColumnReorderContext } from "../dnd/ColumnReorderContext";
import { useDataGridContext } from "../internal/DataGridContext";
import styles from "../DataGrid.module.css";

type HeaderRowProps<TRow> = {
  headers: Header<TRow, unknown>[];
  height: number;
  totalWidth: number;
};

function HeaderRowRender<TRow>({
  headers,
  height,
  totalWidth,
}: HeaderRowProps<TRow>) {
  const { featureFlags } = useDataGridContext();

  if (featureFlags.reorder && headers.length > 0) {
    return (
      <ColumnReorderContext
        headers={headers}
        height={height}
        totalWidth={totalWidth}
      />
    );
  }

  return (
    <div
      className={styles.headerRow}
      style={{ height, width: totalWidth, minWidth: totalWidth }}
      role="row"
    >
      {headers.map((header) => (
        <HeaderCell key={header.id} header={header} />
      ))}
    </div>
  );
}

export const HeaderRow = memo(HeaderRowRender) as typeof HeaderRowRender;
