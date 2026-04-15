import { memo } from "react";
import type { Header } from "@tanstack/react-table";
import { HeaderCell } from "./HeaderCell";
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
