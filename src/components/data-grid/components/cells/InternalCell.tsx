import { flexRender, type Cell as TableCell } from "@tanstack/react-table";
import { memo, useCallback, type CSSProperties } from "react";
import {
  useIsActiveCell,
  useIsEditingCell,
} from "../../hooks/useGridSelection";
import { GRID_Z_INDEX } from "../../constants";
import type { GridSelectionStore } from "../../store/gridSelectionStore";
import type { DataGridColumnDef, DataGridEditCellContext } from "../../types";
import { useCellEditor } from "../../hooks/useCellEditor";

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
  const { loading, pending, cancelledRef, cancelEdit, commit } = useCellEditor({
    closeEditor,
  });

  let style: CSSProperties;
  if (pinned === "left") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      left: `var(--dg-col-${id}-pinned-left)`,
      zIndex: GRID_Z_INDEX.pinnedCell,
    };
  } else if (pinned === "right") {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      right: `var(--dg-col-${id}-pinned-right)`,
      zIndex: GRID_Z_INDEX.pinnedCell,
    };
  } else {
    style = {
      height,
      width: `var(--dg-col-${id}-size)`,
      transform: `translateX(calc(var(--dg-left-total) + var(--dg-col-${id}-start)))`,
      zIndex: isActive ? GRID_Z_INDEX.activeCell : undefined,
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

// Column reorder rebuilds `cell` references in TanStack but the underlying
// columnDef and row.original are stable; the layout-affecting props (className,
// height, rowId, columnId) are also stable. Without a custom comparator the
// default shallow compare fails on every reorder and re-renders every cell —
// observed as a ~120ms self-time spike at drag-end on a ~30×30 visible grid.
const areCellPropsEqual = <TData,>(
  prev: CellProps<TData>,
  next: CellProps<TData>,
) => {
  return (
    prev.height === next.height &&
    prev.className === next.className &&
    prev.rowId === next.rowId &&
    prev.columnId === next.columnId &&
    prev.store === next.store &&
    prev.focusGrid === next.focusGrid &&
    prev.cell.row.original === next.cell.row.original &&
    prev.cell.column.columnDef === next.cell.column.columnDef
  );
};

export const Cell = memo(CellInner, areCellPropsEqual) as typeof CellInner;
