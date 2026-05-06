import { flexRender, type Cell as TableCell } from "@tanstack/react-table";
import { memo, useCallback, type CSSProperties } from "react";
import { useIsActiveCell, useIsEditingCell } from "../../useGridSelection";
import type { GridSelectionStore } from "../../gridSelectionStore";
import type {
  DataGridColumnDef,
  DataGridEditCellContext,
} from "../../types";
import { useCellEditor } from "./useCellEditor";

type CellProps<TData> = {
  cell: TableCell<TData, unknown>;
  height: number;
  className: string;
  rowId: string;
  columnId: string;
  store: GridSelectionStore;
  focusGrid: () => void;
};

/**
 * Internal cell component used in data grid renders, not meant
 * for column cell render uses.
 */
const CellInner = <TData,>({
  cell,
  height,
  className,
  rowId,
  columnId,
  store,
  focusGrid,
}: CellProps<TData>) => {
  const id = cell.column.id;
  const pinned = cell.column.getIsPinned();
  const isActive = useIsActiveCell(store, rowId, columnId);
  const isEditing = useIsEditingCell(store, rowId, columnId);
  const closeEditor = useCallback(() => {
    store.setActive(rowId, columnId);
    focusGrid();
  }, [store, rowId, columnId, focusGrid]);
  const { loading, pending, cancelledRef, cancelEdit, commit } =
    useCellEditor({ closeEditor });

  let style: CSSProperties;
  if (pinned === "left") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      left: `var(--dg-col-${id}-pinned-left)`,
    };
  } else if (pinned === "right") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      right: `var(--dg-col-${id}-pinned-right)`,
    };
  } else {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      transform: `translateX(calc(var(--dg-left-total) + var(--dg-col-${id}-start)))`,
    };
  }

  const finalClassName = isActive ? `${className} dg-cell-active` : className;
  const columnDef = cell.column.columnDef as DataGridColumnDef<TData, unknown>;
  const canEdit = Boolean(columnDef.editable && columnDef.editCell);
  const context = cell.getContext();
  const content =
    isEditing && canEdit && columnDef.editCell
      ? columnDef.editCell({
          ...context,
          value: cell.getValue(),
          loading,
          pending,
          cancelledRef,
          cancel: cancelEdit,
          commit: (next, options) => {
            const hasCurrent =
              options !== undefined &&
              Object.prototype.hasOwnProperty.call(options, "current");
            commit({
              next,
              current: hasCurrent ? options.current : cell.getValue(),
              updateData: (value) =>
                context.table.options.meta?.updateData?.(
                  context.row.index,
                  context.column.id,
                  value,
                ),
              onPending: options?.onPending,
              onSettled: options?.onSettled,
            });
          },
        } satisfies DataGridEditCellContext<TData, unknown>)
      : flexRender(columnDef.cell, context);

  return (
    <div
      className={finalClassName}
      style={style}
      data-row-id={rowId}
      data-column-id={columnId}
    >
      {content}
    </div>
  );
};

export const Cell = memo(CellInner) as typeof CellInner;
