import clsx from "clsx";

import type { Header } from "@tanstack/react-table";
import type { MouseEvent, TouchEvent } from "react";

import styles from "../DataGrid.module.css";

type ResizeHandleProps<TRow> = {
  header: Header<TRow, unknown>;
};

export function ResizeHandle<TRow>({ header }: ResizeHandleProps<TRow>) {
  if (!header.column.getCanResize()) return null;

  const isResizing = header.column.getIsResizing();
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    header.getResizeHandler()(e);
  };
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    header.getResizeHandler()(e);
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div
      className={clsx(
        styles.resizeHandle,
        isResizing && styles.resizeHandleActive,
      )}
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
    />
  );
}
