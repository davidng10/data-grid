import { memo, useRef } from "react";

import { useRovingTabIndex } from "./hooks";
import type { CalculatedColumn, Position } from "./types";
import { clampColumnWidth, classnames } from "./utils";

import cellStyles from "./styles/Cell.module.css";
import headerCellStyles from "./styles/HeaderCell.module.css";

interface HeaderCellProps<R> {
  readonly column: CalculatedColumn<R>;
  readonly isCellActive: boolean;
  /**
   * When the grid has no active position, the first header cell elevates its
   * tab-index so a Tab into the grid lands somewhere interactive. The first
   * focus then sets the active position to this cell.
   */
  readonly shouldFocusGrid: boolean;
  readonly setActivePosition: (position: Position) => void;
  /**
   * Layer 6. Stable identity (wrapped with `useLatestFunc` upstream); fed to
   * the resize handle when `column.resizable`. Receives an already-clamped
   * width — clamping happens in `ResizeHandle` so we never round-trip a
   * width through state that the metrics pass would reject.
   */
  readonly onColumnResize: (columnKey: string, width: number) => void;
}

function HeaderCell<R>({
  column,
  isCellActive,
  shouldFocusGrid,
  setActivePosition,
  onColumnResize,
}: HeaderCellProps<R>) {
  const { tabIndex, childTabIndex, onFocus } = useRovingTabIndex(
    shouldFocusGrid || isCellActive,
  );

  function selectHeaderCell() {
    setActivePosition({ idx: column.idx, rowIdx: -1 });
  }

  function handleFocus(event: React.FocusEvent<HTMLDivElement>) {
    onFocus?.(event);
    if (shouldFocusGrid) {
      // First Tab into the grid lands here — promote it to the active cell.
      selectHeaderCell();
    }
  }

  return (
    <div
      role="columnheader"
      aria-colindex={column.idx + 1}
      aria-selected={isCellActive}
      tabIndex={tabIndex}
      className={classnames(
        cellStyles.cell,
        headerCellStyles.headerCell,
        column.frozen && cellStyles.cellFrozen,
        column.frozen && headerCellStyles.headerCellFrozen,
        isCellActive && cellStyles.cellActive,
        column.resizable && headerCellStyles.headerCellResizable,
        column.headerCellClass,
      )}
      style={{
        gridColumnStart: column.idx + 1,
        insetInlineStart:
          column.frozen === "left"
            ? `var(--rdg-frozen-left-${column.idx})`
            : undefined,
        insetInlineEnd:
          column.frozen === "right"
            ? `var(--rdg-frozen-right-${column.idx})`
            : undefined,
      }}
      onMouseDown={selectHeaderCell}
      onFocus={handleFocus}
    >
      {column.renderHeaderCell({
        column,
        sortDirection: undefined,
        tabIndex: childTabIndex,
      })}
      {column.resizable && (
        <ResizeHandle column={column} onColumnResize={onColumnResize} />
      )}
    </div>
  );
}

const HeaderCellComponent = memo(HeaderCell) as <R>(
  props: HeaderCellProps<R>,
) => React.JSX.Element;

export default HeaderCellComponent;

interface ResizeHandleProps<R> {
  readonly column: CalculatedColumn<R>;
  readonly onColumnResize: (columnKey: string, width: number) => void;
}

/**
 * 10px col-resize strip pinned to the cell's inline-end edge.
 *
 *   - `setPointerCapture` retains the pointer stream on the handle even when
 *     the cursor moves outside the strip (typical drag UX) and ensures
 *     `lostpointercapture` fires for cleanup if the OS interrupts (alt-tab,
 *     window focus loss, etc.) where `pointerup` may not.
 *   - The pointerdown stores `right - clientX` so the handle's grab point
 *     stays under the cursor for the duration of the drag — without it, the
 *     column visibly snaps when the user starts dragging.
 *   - `clampColumnWidth` is applied on every move so a width that violates
 *     `minWidth` / `maxWidth` is never sent to state. Identical clamping in
 *     the metrics pass would already round-trip safely, but clamping at the
 *     source avoids the no-op `setResizedWidths` that would otherwise commit.
 *   - `onClick` stops propagation so the click that ends a drag doesn't bubble
 *     to the header cell (and, in layer 7, won't hit the sort icon).
 */
function ResizeHandle<R>({ column, onColumnResize }: ResizeHandleProps<R>) {
  const grabOffsetRef = useRef<number>(undefined);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Suppress Firefox's column-resize "drag" interference when the column is
    // also a draggable (layer 8) — preventDefault on pointerdown stops the
    // mousedown that would otherwise initiate native drag.
    event.preventDefault();
    const { currentTarget, pointerId } = event;
    currentTarget.setPointerCapture(pointerId);
    const headerCell = currentTarget.parentElement!;
    const { right } = headerCell.getBoundingClientRect();
    grabOffsetRef.current = right - event.clientX;
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const offset = grabOffsetRef.current;
    if (offset === undefined) return;
    const headerCell = event.currentTarget.parentElement!;
    const { left, width } = headerCell.getBoundingClientRect();
    const newWidth = clampColumnWidth(event.clientX + offset - left, column);
    if (width > 0 && newWidth !== width) {
      onColumnResize(column.key, newWidth);
    }
  }

  function onLostPointerCapture() {
    grabOffsetRef.current = undefined;
  }

  function stopPropagation(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      aria-hidden
      className={headerCellStyles.resizeHandle}
      // Stop the click that ends a drag from bubbling to the header cell —
      // in layer 7 the header click cycles sort, and a resize must not do
      // that. Mousedown is intentionally allowed to bubble so the parent
      // header cell still becomes the active position when a resize starts.
      onClick={stopPropagation}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onLostPointerCapture={onLostPointerCapture}
    />
  );
}
