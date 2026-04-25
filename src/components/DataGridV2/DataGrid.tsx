import { useRef, type KeyboardEvent } from "react";

import HeaderRow from "./HeaderRow";
import Row from "./Row";
import { DEFAULT_ROW_HEIGHT } from "./constants";
import {
  useActivePosition,
  useCalculatedColumns,
  useGridDimensions,
  useLatestFunc,
  useScrollState,
  useViewportColumns,
  useViewportRows,
  type ActivePosition,
} from "./hooks";
import type { DataGridProps, Position } from "./types";
import {
  canExitGrid,
  classnames,
  createCellEvent,
  getNextPosition,
  isSamePosition,
} from "./utils";

import dataGridStyles from "./styles/DataGrid.module.css";

/**
 * Layer 4: active position + keyboard navigation.
 *
 *   - `useActivePosition` owns the `{idx, rowIdx, mode: 'ACTIVE'}` coordinate
 *     plus a separate `positionToFocus` slot that drives the layout-effect
 *     `focusCell` call. Mousedown selects without explicitly focusing (the
 *     browser already does that on click). Keyboard nav explicitly focuses.
 *   - `useViewportColumns` exposes a per-row iterator that injects the active
 *     unpinned column when it sits outside the overscan window. Combined
 *     with the row iterator below, the active cell stays mounted under both
 *     vertical and horizontal scroll, so focus is never lost.
 *   - `handleKeyDown` runs at the grid root. Layer 4 is `ACTIVE`-mode only —
 *     no `'EDIT'` mode, no `CHANGE_ROW` Tab wrapping. `canExitGrid` gates
 *     focus escape; otherwise `event.preventDefault()` keeps the browser
 *     from scrolling and we navigate via `getNextPosition`.
 *   - `onCellKeyDown` is invoked first with `preventGridDefault()`; consumers
 *     that intercept a key short-circuit the grid's own handling.
 *
 * Out of scope (later layers):
 *   - Row selection (layer 5): `Shift+Space` toggle + checkbox column.
 *   - Sort hotkey (layer 7): Space/Enter on header to cycle sort.
 *   - Expansion-aware ArrowDown skip past detail panels (layer 9).
 */
export function DataGrid<R>({
  columns: rawColumns,
  rows,
  rowKeyGetter,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerRowHeight,
  onCellClick,
  onCellKeyDown,
  className,
  style,
  "aria-label": ariaLabel,
}: DataGridProps<R>) {
  const gridRef = useRef<HTMLDivElement>(null);

  const { scrollTop, scrollLeft } = useScrollState(gridRef);
  const [gridWidth, gridHeight] = useGridDimensions(gridRef);

  const {
    columns,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
    templateColumns,
    layoutCssVars,
    colOverscanStartIdx,
    colOverscanEndIdx,
    totalFrozenLeftColumnWidth,
    totalFrozenRightColumnWidth,
  } = useCalculatedColumns({
    rawColumns,
    scrollLeft,
    viewportWidth: gridWidth,
  });

  const resolvedHeaderRowHeight = headerRowHeight ?? rowHeight;
  const clientHeight = Math.max(0, gridHeight - resolvedHeaderRowHeight);

  const {
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    gridTemplateRows: bodyTemplateRows,
  } = useViewportRows({
    rowCount: rows.length,
    rowHeight,
    clientHeight,
    scrollTop,
  });

  const { iterateOverViewportColumnsForRow } = useViewportColumns({
    columns,
    colOverscanStartIdx,
    colOverscanEndIdx,
    lastFrozenLeftColumnIndex,
    firstFrozenRightColumnIndex,
  });

  // ---- active position ---------------------------------------------------

  const maxColIdx = columns.length - 1;
  const minRowIdx = -1;
  const maxRowIdx = rows.length - 1;

  const {
    activePosition,
    setActivePosition,
    setPositionToFocus,
    validatePosition,
    isActiveInBounds,
  } = useActivePosition({
    gridRef,
    maxColIdx,
    minRowIdx,
    maxRowIdx,
  });

  function setPosition(
    position: Position,
    options?: { readonly shouldFocus?: boolean },
  ) {
    if (!validatePosition(position).isInActiveBounds) return;

    if (isSamePosition(activePosition, position)) {
      // Same cell: nothing to update, but a keyboard request still wants the
      // cell scrolled into view.
      if (options?.shouldFocus) {
        const next: ActivePosition = { ...position, mode: "ACTIVE" };
        setPositionToFocus(next);
      }
      return;
    }

    const next: ActivePosition = { ...position, mode: "ACTIVE" };
    setActivePosition(next);
    if (options?.shouldFocus) setPositionToFocus(next);
  }

  // useLatestFunc-wrapped variants so memoized children don't re-render when
  // the consumer's callback identity changes (or when our setPosition closes
  // over different state across renders).
  const setActivePositionLatest = useLatestFunc<(p: Position) => void>((p) =>
    setPosition(p),
  );
  const onCellClickLatest = useLatestFunc(onCellClick);
  const onCellKeyDownLatest = useLatestFunc(onCellKeyDown);

  // ---- keyboard nav at the grid root ------------------------------------

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Consumer hook first — preventGridDefault() short-circuits us.
    if (onCellKeyDownLatest && isActiveInBounds) {
      const cellEvent = createCellEvent(event);
      const { idx, rowIdx } = activePosition;
      const isHeader = rowIdx === -1;
      onCellKeyDownLatest(
        {
          mode: "ACTIVE",
          column: columns[idx],
          row: isHeader ? undefined : rows[rowIdx],
          rowIdx,
          setActivePosition: setActivePositionLatest,
        },
        cellEvent,
      );
      if (cellEvent.isGridDefaultPrevented()) return;
    }

    // Only navigation keys participate in grid handling.
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "Tab":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        navigate(event);
        break;
      default:
        break;
    }
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!isActiveInBounds) return;
    const { key, shiftKey } = event;

    if (key === "Tab") {
      if (canExitGrid({ maxColIdx, activePosition, shiftKey })) {
        // Let the browser's tab order take over.
        return;
      }
    }

    // Stop the browser's default scroll / focus-change for nav keys we own.
    event.preventDefault();

    const ctrlKey = event.ctrlKey || event.metaKey;
    const next = getNextPosition({
      key,
      ctrlKey,
      shiftKey,
      activePosition,
      maxColIdx,
      minRowIdx,
      maxRowIdx,
      clientHeight,
      rowHeight,
    });
    if (isSamePosition(activePosition, next)) return;
    setPosition(next, { shouldFocus: true });
  }

  // ---- row iteration (active row may sit outside overscan) ---------------

  const activeRowIdx = activePosition.rowIdx;
  const activeIsDataRow = activeRowIdx >= 0 && activeRowIdx <= maxRowIdx;
  const activeIsHeader = activeRowIdx === -1 && isActiveInBounds;

  function renderDataRow(rowIdx: number, isOutsideViewport: boolean) {
    const row = rows[rowIdx];
    return (
      <Row
        key={rowKeyGetter(row)}
        row={row}
        rowIdx={rowIdx}
        gridRowStart={rowIdx + 2}
        iterateOverViewportColumnsForRow={iterateOverViewportColumnsForRow}
        activeCellIdx={rowIdx === activeRowIdx ? activePosition.idx : -1}
        isOutsideViewport={isOutsideViewport}
        setActivePosition={setActivePositionLatest}
        onCellClick={onCellClickLatest}
      />
    );
  }

  const viewportRows: React.ReactNode[] = [];

  // Yield the active row when it sits outside the overscan window so its
  // active cell is mounted (focus + keyboard nav rely on the DOM node
  // existing). Off-viewport rows render *only* the active cell — there's no
  // point materialising the rest of the slice for a row the user can't see.
  if (activeIsDataRow && activeRowIdx < rowOverscanStartIdx) {
    viewportRows.push(renderDataRow(activeRowIdx, true));
  }
  for (let rowIdx = rowOverscanStartIdx; rowIdx <= rowOverscanEndIdx; rowIdx++) {
    viewportRows.push(renderDataRow(rowIdx, false));
  }
  if (activeIsDataRow && activeRowIdx > rowOverscanEndIdx) {
    viewportRows.push(renderDataRow(activeRowIdx, true));
  }

  // ---- root template ----------------------------------------------------

  const gridTemplateRows = `${resolvedHeaderRowHeight}px${bodyTemplateRows}`;

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      tabIndex={-1}
      className={classnames(dataGridStyles.root, className)}
      style={
        {
          ...style,
          ...layoutCssVars,
          gridTemplateColumns: templateColumns,
          gridTemplateRows,
          // Sticky pinned columns + sticky header occlude scroll-into-view's
          // "nearest" target rect. Pad the scroll container by the pinned
          // bands' widths and the header row height so keyboard nav into a
          // cell behind the pinned/header chrome actually scrolls.
          scrollPaddingInlineStart: totalFrozenLeftColumnWidth,
          scrollPaddingInlineEnd: totalFrozenRightColumnWidth,
          scrollPaddingBlockStart: resolvedHeaderRowHeight,
          "--rdg-row-height": `${rowHeight}px`,
          "--rdg-header-row-height": `${resolvedHeaderRowHeight}px`,
        } as React.CSSProperties
      }
      onKeyDown={handleKeyDown}
    >
      <HeaderRow
        iterateOverViewportColumnsForRow={iterateOverViewportColumnsForRow}
        activeCellIdx={activeIsHeader ? activePosition.idx : -1}
        shouldFocusGrid={!isActiveInBounds}
        setActivePosition={setActivePositionLatest}
      />
      {viewportRows}
    </div>
  );
}
