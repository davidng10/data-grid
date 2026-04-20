import { memo } from "react";
import clsx from "clsx";

import { useDataGridActions } from "../../hooks/useDataGridContext";
import { TextCell } from "../cells/TextCell";

import type { Cell } from "@tanstack/react-table";
import type { CSSProperties, MouseEvent } from "react";
import type {
  DataGridCellAlign,
  DataGridCellProps,
  DataGridColumnDef,
} from "../../types";

import styles from "../../DataGrid.module.css";

type BodyCellProps<TRow> = {
  cell: Cell<TRow, unknown>;
  rowIndex: number;
  rowId: string;
  size: number;
  pinned: "left" | "right" | false;
  pinLeft: number;
  pinRight: number;
  isInRange: boolean;
  isRangeAnchor: boolean;
  isRangeFocus: boolean;
  isSelected: boolean;
  // The __select__ column opts out of range-drag handlers so clicking a
  // checkbox doesn't start / clear a range.
  wireRangeHandlers: boolean;
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
  isInRange,
  isRangeAnchor,
  isRangeFocus,
  isSelected,
  wireRangeHandlers,
}: BodyCellProps<TRow>) {
  const { cellMouseHandlers } = useDataGridActions();

  const meta = cell.column.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  const dgColumn = meta?.dataGridColumn;

  const render = dgColumn?.render ?? TextCell;
  const align: DataGridCellAlign = dgColumn?.align ?? "left";
  const value = cell.getValue();
  const row = cell.row.original;
  const pinStyle: CSSProperties =
    pinned === "left"
      ? { left: `${pinLeft}px` }
      : pinned === "right"
        ? { right: `${pinRight}px` }
        : {};

  const cellProps: DataGridCellProps<TRow, unknown> = {
    row,
    rowId,
    rowIndex,
    column: dgColumn as unknown as DataGridColumnDef<TRow, unknown>,
    value,
    align,
    isEditing: false,
    draftValue: undefined,
    setDraftValue: NOOP,
    commitEdit: NOOP,
    cancelEdit: NOOP,
    isInRange,
    isRangeAnchor,
    isRangeFocus,
    isSelected,
  };

  const onMouseDown = wireRangeHandlers
    ? (e: MouseEvent<HTMLDivElement>) =>
        cellMouseHandlers.onCellMouseDown(rowIndex, cell.column.id, e)
    : undefined;
  const onMouseEnter = wireRangeHandlers
    ? () => cellMouseHandlers.onCellMouseEnter(rowIndex, cell.column.id)
    : undefined;
  const onContextMenu = wireRangeHandlers
    ? (e: MouseEvent<HTMLDivElement>) =>
        cellMouseHandlers.onCellContextMenu(rowIndex, cell.column.id, e)
    : undefined;

  return (
    <div
      className={clsx(
        styles.bodyCell,
        pinned === "left" && styles.bodyCellPinnedLeft,
        pinned === "right" && styles.bodyCellPinnedRight,
        isInRange && styles.bodyCellInRange,
        isRangeAnchor && styles.bodyCellRangeAnchor,
        isRangeFocus && styles.bodyCellRangeFocus,
        isSelected && styles.bodyCellRowSelected,
      )}
      style={{
        width: size,
        minWidth: size,
        justifyContent: alignToFlex(align),
        ...pinStyle,
      }}
      role="cell"
      data-column-id={cell.column.id}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
    >
      {render(cellProps)}
    </div>
  );
}

function alignToFlex(align: DataGridCellAlign): string {
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
