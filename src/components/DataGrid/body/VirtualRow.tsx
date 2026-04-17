import type { Row } from "@tanstack/react-table";
import { BodyCell } from "./BodyCell";
import styles from "../DataGrid.module.css";

type VirtualRowProps<TRow> = {
  row: Row<TRow>;
  top: number;
  height: number;
  totalWidth: number;
};

export function VirtualRow<TRow>({
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
      {cells.map((cell) => {
        const pinned = cell.column.getIsPinned();
        return (
          <BodyCell
            key={cell.id}
            cell={cell}
            rowIndex={row.index}
            rowId={row.id}
            size={cell.column.getSize()}
            pinned={pinned}
            pinLeft={pinned === "left" ? cell.column.getStart("left") : 0}
            pinRight={pinned === "right" ? cell.column.getAfter("right") : 0}
          />
        );
      })}
    </div>
  );
}


