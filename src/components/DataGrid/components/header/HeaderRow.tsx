import type { Header } from "@tanstack/react-table";

import { useDataGridConfig } from "../../hooks/useDataGridContext";
import { ColumnReorderContext } from "./ColumnReorderContext";
import { HeaderCell } from "./HeaderCell";
import styles from "../../DataGrid.module.css";

type HeaderRowProps<TRow> = {
  headers: Header<TRow, unknown>[];
  height: number;
  totalWidth: number;
};

// Intentionally NOT memoized. HeaderRow is the un-memoed boundary that reads
// live TanStack state (`getSize`, `getIsPinned`, `getIsSorted`, etc.) and
// passes the values down as explicit props. There's only one HeaderRow per
// table with ~40 children at most, so re-running it on every parent render
// is cheap and removes the risk of a memo skip silently staling the headers.
export function HeaderRow<TRow>({
  headers,
  height,
  totalWidth,
}: HeaderRowProps<TRow>) {
  const { featureFlags } = useDataGridConfig();

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
      {headers.map((header) => {
        const pinned = header.column.getIsPinned();
        return (
          <HeaderCell
            key={header.id}
            header={header}
            size={header.getSize()}
            pinned={pinned}
            pinLeft={pinned === "left" ? header.column.getStart("left") : 0}
            pinRight={pinned === "right" ? header.column.getAfter("right") : 0}
            sortDir={header.column.getIsSorted()}
          />
        );
      })}
    </div>
  );
}
