import { memo } from "react";
import type { Row } from "@tanstack/react-table";
import { BodyCell } from "./BodyCell";
import styles from "../DataGrid.module.css";

type VirtualRowProps<TRow> = {
  row: Row<TRow>;
  top: number;
  height: number;
  totalWidth: number;
};

function VirtualRowRender<TRow>({
  row,
  top,
  height,
  totalWidth,
}: VirtualRowProps<TRow>) {
  const cells = row.getVisibleCells();
  return (
    <div
      className={styles.bodyRow}
      style={{ top, height, width: totalWidth, minWidth: totalWidth }}
      role="row"
      data-row-id={row.id}
    >
      {cells.map((cell) => (
        <BodyCell
          key={cell.id}
          cell={cell}
          rowIndex={row.index}
          rowId={row.id}
        />
      ))}
    </div>
  );
}

export const VirtualRow = memo(VirtualRowRender) as typeof VirtualRowRender;
