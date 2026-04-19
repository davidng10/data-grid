import { memo } from "react";
import { flexRender } from "@tanstack/react-table";
import clsx from "clsx";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Header } from "@tanstack/react-table";
import type {
  CSSProperties,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { useDataGridContext } from "..//useDataGridContext";
import { HeaderMenu } from "./HeaderMenu";
import { ResizeHandle } from "./ResizeHandle";
import type { DataGridColumnDef } from "../DataGrid.types";

import styles from "../DataGrid.module.css";

type SortDir = false | "asc" | "desc";

type HeaderCellProps<TRow> = {
  header: Header<TRow, unknown>;
  // Live TanStack state is read at the un-memoed boundary (HeaderRow /
  // ColumnReorderContext) and forwarded as explicit props. If we read these
  // off `header.column.*` here, a memo skip would silently render stale
  // sizing / pinning / sort. See plan/01_architecture.md "Pattern — reading
  // TanStack state in memoed leaves".
  size: number;
  pinned: "left" | "right" | false;
  pinLeft: number;
  pinRight: number;
  sortDir: SortDir;
  // Drag plumbing (only present when reorder is enabled). Flat props rather
  // than a wrapper object so React.memo's shallow compare reflects what
  // actually changed.
  dragSetNodeRef?: (node: HTMLElement | null) => void;
  dragTransform?: string;
  dragTransition?: string;
  dragListeners?: SyntheticListenerMap;
  dragAttributes?: DraggableAttributes;
  dragIsDragging?: boolean;
  dragDisabled?: boolean;
};

function HeaderCellRender<TRow>({
  header,
  size,
  pinned,
  pinLeft,
  pinRight,
  sortDir,
  dragSetNodeRef,
  dragTransform,
  dragTransition,
  dragListeners,
  dragAttributes,
  dragIsDragging,
  dragDisabled,
}: HeaderCellProps<TRow>) {
  const { featureFlags } = useDataGridContext();
  const pinStyle: CSSProperties =
    pinned === "left"
      ? { left: `${pinLeft}px` }
      : pinned === "right"
        ? { right: `${pinRight}px` }
        : {};

  const dragStyle: CSSProperties = {
    transform: dragTransform,
    transition: dragTransition,
  };

  if (header.isPlaceholder) {
    return (
      <div
        ref={dragSetNodeRef}
        className={clsx(
          styles.headerCell,
          pinned === "left" && styles.headerCellPinnedLeft,
          pinned === "right" && styles.headerCellPinnedRight,
        )}
        style={{
          width: size,
          minWidth: size,
          ...pinStyle,
          ...dragStyle,
        }}
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

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!sortable) return;
    e.preventDefault();
    if (sortDir === false) {
      header.column.toggleSorting(false, false);
    } else if (sortDir === "asc") {
      header.column.toggleSorting(true, false);
    } else {
      header.column.clearSorting();
    }
  };

  const showDragHandle = !!dragSetNodeRef && !dragDisabled;

  return (
    <div
      ref={dragSetNodeRef}
      className={clsx(
        styles.headerCell,
        sortable && styles.headerCellSortable,
        pinned === "left" && styles.headerCellPinnedLeft,
        pinned === "right" && styles.headerCellPinnedRight,
        dragIsDragging && styles.headerCellDragging,
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
          {...(dragAttributes ?? {})}
          onClick={(e: MouseEvent<HTMLSpanElement>) => e.stopPropagation()}
          onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            dragListeners?.onPointerDown?.(e);
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
