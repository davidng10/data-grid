import {
  memo,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flexRender, type Header } from "@tanstack/react-table";
import clsx from "clsx";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { DataGridColumnDef } from "../DataGrid.types";
import { useDataGridContext } from "../internal/DataGridContext";
import { HeaderMenu } from "./HeaderMenu";
import { ResizeHandle } from "./ResizeHandle";
import styles from "../DataGrid.module.css";

export type HeaderCellDragProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  transformStyle: string | undefined;
  transitionStyle: string | undefined;
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
  isDragging: boolean;
  disabled: boolean;
};

type HeaderCellProps<TRow> = {
  header: Header<TRow, unknown>;
  drag?: HeaderCellDragProps;
};

function HeaderCellRender<TRow>({ header, drag }: HeaderCellProps<TRow>) {
  const { featureFlags } = useDataGridContext();
  const size = header.getSize();
  const pinned = header.column.getIsPinned();
  const pinStyle: CSSProperties =
    pinned === "left"
      ? { left: `${header.column.getStart("left")}px` }
      : pinned === "right"
        ? { right: `${header.column.getAfter("right")}px` }
        : {};

  const dragStyle: CSSProperties = drag
    ? {
        transform: drag.transformStyle,
        transition: drag.transitionStyle,
      }
    : {};

  if (header.isPlaceholder) {
    return (
      <div
        ref={drag?.setNodeRef}
        className={clsx(
          styles.headerCell,
          pinned === "left" && styles.headerCellPinnedLeft,
          pinned === "right" && styles.headerCellPinnedRight,
        )}
        style={{ width: size, minWidth: size, ...pinStyle, ...dragStyle }}
        role="columnheader"
      />
    );
  }

  const meta = header.column.columnDef.meta as
    | { dataGridColumn?: DataGridColumnDef<TRow> }
    | undefined;
  const dgColumn = meta?.dataGridColumn;
  const columnAllowsSort =
    dgColumn?.meta?.sortable === undefined ? true : dgColumn.meta.sortable;
  const sortable = featureFlags.sorting && columnAllowsSort;
  const sortDir = header.column.getIsSorted();

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!sortable) return;
    e.preventDefault();
    const current = header.column.getIsSorted();
    if (current === false) {
      header.column.toggleSorting(false, false);
    } else if (current === "asc") {
      header.column.toggleSorting(true, false);
    } else {
      header.column.clearSorting();
    }
  };

  const showDragHandle = !!drag && !drag.disabled;

  return (
    <div
      ref={drag?.setNodeRef}
      className={clsx(
        styles.headerCell,
        sortable && styles.headerCellSortable,
        pinned === "left" && styles.headerCellPinnedLeft,
        pinned === "right" && styles.headerCellPinnedRight,
        drag?.isDragging && styles.headerCellDragging,
      )}
      style={{ width: size, minWidth: size, ...pinStyle, ...dragStyle }}
      role="columnheader"
      aria-sort={
        sortDir === "asc"
          ? "ascending"
          : sortDir === "desc"
            ? "descending"
            : "none"
      }
      onClick={sortable ? handleClick : undefined}
    >
      {showDragHandle && (
        <span
          className={styles.headerDragHandle}
          aria-label="Drag to reorder"
          {...drag!.attributes}
          onClick={(e: MouseEvent<HTMLSpanElement>) => e.stopPropagation()}
          onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            drag!.listeners?.onPointerDown?.(e);
          }}
        >
          ⋮⋮
        </span>
      )}
      <span className={styles.headerLabel}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </span>
      {sortDir !== false && (
        <span className={styles.sortIndicator} aria-hidden>
          {sortDir === "asc" ? "▲" : "▼"}
        </span>
      )}
      <HeaderMenu header={header} />
      {featureFlags.resize && <ResizeHandle header={header} />}
    </div>
  );
}

export const HeaderCell = memo(HeaderCellRender) as typeof HeaderCellRender;
