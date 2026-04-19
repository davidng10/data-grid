import type { ReactNode } from "react";
import type { DataGridCellProps } from "../DataGrid.types";

import styles from "../DataGrid.module.css";

export function TextCell<TRow, TValue>(
  props: DataGridCellProps<TRow, TValue>,
): ReactNode {
  const { value, align } = props;
  const text = value == null ? "" : String(value);
  return (
    <span className={styles.textCell} title={text} style={{ textAlign: align }}>
      {text}
    </span>
  );
}
