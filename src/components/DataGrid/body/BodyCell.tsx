import { memo, type CSSProperties } from "react";
import type { Cell } from "@tanstack/react-table";
import clsx from "clsx";
import type {
  Align,
  CellRenderer,
  DataGridCellProps,
  DataGridColumnDef,
} from "../DataGrid.types";
import { TextCell } from "../cells/TextCell";
import { useDataGridContext } from "../internal/DataGridContext";
import styles from "../DataGrid.module.css";

type BodyCellProps<TRow> = {
  cell: Cell<TRow, unknown>;
  rowIndex: number;
  rowId: string;
  // Size / pin state are passed as explicit props rather than read off
  // `cell.column.*` because TanStack keeps cell refs stable even when
  // column sizing or pinning changes — if we read inside the memo'd cell,
  // resizes silently stale the body. Passing them in makes memo invalidate
  // on the state that actually affects layout.
  size: number;
  pinned: "left" | "right" | false;
  pinLeft: number;
  pinRight: number;
};

const NOOP = () => {};

function BodyCellRender<TRow>({
  cell,
  rowIndex,
  rowId,
  size,
  pinned,
  pinLeft,
  pinRight,
}: BodyCellProps<TRow>) {
  const { cellExtras } = useDataGridContext();

  const meta = cell.column.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  const dgColumn = meta?.dataGridColumn;

  // `any` generics bridge the bivariance gap between column-specific
  // renderers and the generic TextCell fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Renderer: CellRenderer<any, any> = dgColumn?.cell ?? TextCell;
  const align: Align = dgColumn?.align ?? "left";
  const value = cell.getValue();
  const row = cell.row.original;
  const pinStyle: CSSProperties =
    pinned === "left"
      ? { left: `${pinLeft}px` }
      : pinned === "right"
        ? { right: `${pinRight}px` }
        : {};

  const cellProps: DataGridCellProps<unknown, unknown> = {
    row,
    rowId,
    rowIndex,
    column: dgColumn as unknown as DataGridColumnDef<unknown, unknown>,
    value,
    align,
    isEditing: false,
    draftValue: undefined,
    setDraftValue: NOOP,
    commitEdit: NOOP,
    cancelEdit: NOOP,
    isInRange: false,
    isRangeAnchor: false,
    isRangeFocus: false,
    extras: cellExtras,
  };

  return (
    <div
      className={clsx(
        styles.bodyCell,
        pinned === "left" && styles.bodyCellPinnedLeft,
        pinned === "right" && styles.bodyCellPinnedRight,
      )}
      style={{
        width: size,
        minWidth: size,
        justifyContent: alignToFlex(align),
        ...pinStyle,
      }}
      role="cell"
    >
      <Renderer {...cellProps} />
    </div>
  );
}

function alignToFlex(align: Align): string {
  switch (align) {
    case "right":
      return "flex-end";
    case "center":
      return "center";
    default:
      return "flex-start";
  }
}

export const BodyCell = memo(BodyCellRender) as typeof BodyCellRender;
