import { memo } from "react";
import type { CellRenderer, DataGridCellProps } from "../DataGrid.types";
import styles from "../DataGrid.module.css";

function TextCellRender(props: DataGridCellProps<unknown, unknown>) {
  const { value, align } = props;
  const text = value == null ? "" : String(value);
  return (
    <span
      className={styles.textCell}
      title={text}
      style={{ textAlign: align }}
    >
      {text}
    </span>
  );
}

const MemoedTextCell = memo(TextCellRender, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.align === next.align &&
    prev.isInRange === next.isInRange &&
    prev.isEditing === next.isEditing
  );
});

// TextCell is intentionally generic-free: it does not inspect TRow or TValue.
// Typed with `any` generics so it is assignable to any `cell: CellRenderer<TRow, TValue>`
// slot via the `any` bivariance escape hatch — TypeScript cannot otherwise bridge
// the contravariant `accessor: (row: TRow) => TValue` on DataGridColumnDef.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TextCell = MemoedTextCell as unknown as CellRenderer<any, any>;
