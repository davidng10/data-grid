import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import HeaderRow from "./HeaderRow";
import Row from "./Row";
import { SelectColumn } from "./columns";
import { DEFAULT_ROW_HEIGHT } from "./constants";
import {
  HeaderRowSelectionChangeContext,
  HeaderRowSelectionContext,
  RowSelectionChangeContext,
  type HeaderRowSelectionContextValue,
  type SelectHeaderRowEvent,
  type SelectRowEvent,
} from "./contexts";
import {
  useActivePosition,
  useCalculatedColumns,
  useColumnWidths,
  useGridDimensions,
  useLatestFunc,
  useScrollState,
  useViewportColumns,
  useViewportRows,
  type ActivePosition,
} from "./hooks";
import type { Column, DataGridProps, Position } from "./types";
import {
  canExitGrid,
  classnames,
  createCellEvent,
  getNextPosition,
  isSamePosition,
} from "./utils";

import dataGridStyles from "./styles/DataGrid.module.css";

/**
 * Layer 5: row selection.
 *
 *   - Selection is fully controlled. The grid only fires `onSelectedRowsChange`
 *     and reads `selectedRows`; consumer owns the state. The internal
 *     `SELECT_COLUMN` is injected (frozen-left, 40px) when *both* props are
 *     present — partial wiring is treated as "selection off".
 *   - Two split-context broadcasts:
 *     - Per-row: `Row` provides `RowSelectionContext` with its `{isRowSelected,
 *       isRowSelectionDisabled}`. Toggling one row only re-renders that row's
 *       provider and its `SelectColumn` cell consumer; every other row stays
 *       memo-stable. The change handler lives in a separate, stable
 *       `RowSelectionChangeContext` so non-value consumers don't subscribe to
 *       value updates.
 *     - Header: `HeaderRowSelectionContext` carries
 *       `{isRowSelected, isIndeterminate}` derived from `selectedRows.size` vs
 *       `rows.length - disabledCount` — never iterates `rows` per render.
 *   - `Shift+Space` on the active data cell toggles that row's selection
 *     (intercepted before the nav switch in `handleKeyDown`).
 *   - `previousRowIdx` (rowIdx, not row object) tracks the last anchor for
 *     shift-click range selection so range toggles run in O(range) without
 *     `rows.indexOf()`.
 *
 * Out of scope (later layers):
 *   - Column resize (layer 6), sort (layer 7), reorder (layer 8), expansion
 *     (layer 9). Hooks for those slot in alongside the selection wiring; this
 *     file already establishes the orchestration shape they need.
 */
export function DataGrid<R>({
  columns: rawColumns,
  rows,
  rowKeyGetter,
  rowHeight = DEFAULT_ROW_HEIGHT,
  headerRowHeight,
  selectedRows,
  onSelectedRowsChange,
  isRowSelectionDisabled,
  onColumnResize,
  onCellClick,
  onCellKeyDown,
  className,
  style,
  "aria-label": ariaLabel,
}: DataGridProps<R>) {
  const gridRef = useRef<HTMLDivElement>(null);

  const isSelectable = selectedRows != null && onSelectedRowsChange != null;

  const { scrollTop, scrollLeft } = useScrollState(gridRef);
  const [gridWidth, gridHeight] = useGridDimensions(gridRef);

  // Inject SELECT_COLUMN ahead of integrator columns when selection is wired.
  // The cast is safe — SelectColumn never reads row data; it forwards rowIdx
  // through context only.
  const rawColumnsWithInternal = useMemo<readonly Column<R>[]>(
    () =>
      isSelectable ? [SelectColumn as Column<R>, ...rawColumns] : rawColumns,
    [rawColumns, isSelectable],
  );

  // Layer 6. The resize map is keyed by `column.key` and survives column
  // reorder / dataset toggles for free — keys outlive their CalculatedColumn
  // identity. `handleColumnResize` is stable; the map identity changes only
  // on commit, gating downstream metrics rebuilds.
  const { resizedWidths, handleColumnResize } = useColumnWidths({
    onColumnResize,
  });

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
    rawColumns: rawColumnsWithInternal,
    scrollLeft,
    viewportWidth: gridWidth,
    resizedWidths,
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

  // ---- selection ---------------------------------------------------------

  // Anchor row for shift-click range selection. Tracked as an integer rowIdx
  // (not a row object) so range toggles never need `rows.indexOf()`.
  const [previousRowIdx, setPreviousRowIdx] = useState(-1);

  // The anchor is meaningful only relative to the current `rows` reference —
  // a filter / sort / dataset swap leaves the integer pointing at a different
  // row entity (or a stale-but-in-bounds index that would make a subsequent
  // shift-click span the wrong range, possibly running an O(rows.length)
  // walk). Reset during render when we detect a new `rows` ref. Set-state
  // during render is React-supported (same pattern as `useActivePosition`)
  // and React dedupes the resulting commit with the rows-change commit.
  const lastRowsRef = useRef(rows);
  if (lastRowsRef.current !== rows) {
    lastRowsRef.current = rows;
    if (previousRowIdx !== -1) setPreviousRowIdx(-1);
  }

  // The single O(N) selection cost the plan accepts: counts disabled rows.
  // Re-runs only when `rows` or the predicate identity change, never on
  // selection toggles. Consumers should memoise their `isRowSelectionDisabled`
  // (e.g. with `useCallback`) to keep this stable.
  const disabledCount = useMemo(() => {
    if (isRowSelectionDisabled == null) return 0;
    let n = 0;
    for (const row of rows) {
      if (isRowSelectionDisabled(row)) n++;
    }
    return n;
  }, [rows, isRowSelectionDisabled]);

  function selectRow({ rowIdx, checked, isShiftClick }: SelectRowEvent): void {
    if (selectedRows == null || onSelectedRowsChange == null) return;
    if (rowIdx < 0 || rowIdx > maxRowIdx) return;

    const row = rows[rowIdx];
    if (isRowSelectionDisabled?.(row) === true) return;

    const newSelectedRows = new Set(selectedRows);
    const rowKey = rowKeyGetter(row);
    if (checked) {
      newSelectedRows.add(rowKey);
    } else {
      newSelectedRows.delete(rowKey);
    }

    if (
      isShiftClick &&
      previousRowIdx !== -1 &&
      previousRowIdx !== rowIdx &&
      previousRowIdx <= maxRowIdx
    ) {
      // Toggle the *interior* of the range; the just-clicked row was already
      // toggled above and the previous-anchor row keeps its existing state
      // (matches the standard "shift extends from anchor in new direction"
      // behaviour). O(range), not O(N).
      const [lo, hi] =
        previousRowIdx < rowIdx
          ? [previousRowIdx, rowIdx]
          : [rowIdx, previousRowIdx];
      for (let i = lo + 1; i < hi; i++) {
        const r = rows[i];
        if (isRowSelectionDisabled?.(r) === true) continue;
        const k = rowKeyGetter(r);
        if (checked) {
          newSelectedRows.add(k);
        } else {
          newSelectedRows.delete(k);
        }
      }
    }

    setPreviousRowIdx(rowIdx);
    onSelectedRowsChange(newSelectedRows);
  }

  function selectHeaderRow({ checked }: SelectHeaderRowEvent): void {
    if (selectedRows == null || onSelectedRowsChange == null) return;
    // Clone the current set so keys for rows not in the current `rows` array
    // (e.g. consumer-filtered) are preserved. We only flip the keys for rows
    // currently in view.
    const newSelectedRows = new Set(selectedRows);
    for (const row of rows) {
      if (isRowSelectionDisabled?.(row) === true) continue;
      const rowKey = rowKeyGetter(row);
      if (checked) {
        newSelectedRows.add(rowKey);
      } else {
        newSelectedRows.delete(rowKey);
      }
    }
    onSelectedRowsChange(newSelectedRows);
  }

  // Header "select all" / "indeterminate" state, derived from `selectedRows.size`
  // vs the number of selectable rows. Never iterates `rows` per render —
  // `disabledCount` is the only iteration cost and it is memoised above.
  // Note: if the consumer's `selectedRows` contains keys for rows no longer in
  // `rows`, `size` may exceed `selectableCount`; we accept that and treat
  // `>= selectableCount` as "all".
  const headerSelectionValue = useMemo<HeaderRowSelectionContextValue>(() => {
    if (!isSelectable || selectedRows.size === 0 || rows.length === 0) {
      return { isRowSelected: false, isIndeterminate: false };
    }
    const selectableCount = rows.length - disabledCount;
    if (selectableCount <= 0) {
      return { isRowSelected: false, isIndeterminate: false };
    }
    return {
      isRowSelected: selectedRows.size >= selectableCount,
      isIndeterminate: selectedRows.size < selectableCount,
    };
  }, [isSelectable, selectedRows, rows.length, disabledCount]);

  // useLatestFunc-wrapped variants so memoized children don't re-render when
  // the consumer's callback identity changes (or when our setPosition closes
  // over different state across renders).
  const setActivePositionLatest = useLatestFunc<(p: Position) => void>((p) =>
    setPosition(p),
  );
  const onCellClickLatest = useLatestFunc(onCellClick);
  const onCellKeyDownLatest = useLatestFunc(onCellKeyDown);
  const selectRowLatest = useLatestFunc(selectRow);
  const selectHeaderRowLatest = useLatestFunc(selectHeaderRow);

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

    // Shift+Space toggles selection on the active data row. Header rows and
    // out-of-bounds positions fall through. Take this *before* the nav switch
    // so the browser's default Space-scroll never fires when selection is on.
    if (
      isSelectable &&
      event.shiftKey &&
      event.key === " " &&
      isActiveInBounds &&
      activePosition.rowIdx >= 0
    ) {
      const row = rows[activePosition.rowIdx];
      const rowKey = rowKeyGetter(row);
      selectRow({
        rowIdx: activePosition.rowIdx,
        checked: !selectedRows.has(rowKey),
        isShiftClick: false,
      });
      event.preventDefault();
      return;
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

  function getRowSelectionState(rowIdx: number): {
    isRowSelected: boolean;
    isRowSelectionDisabled: boolean;
  } {
    if (!isSelectable) {
      return { isRowSelected: false, isRowSelectionDisabled: false };
    }
    const row = rows[rowIdx];
    return {
      isRowSelected: selectedRows.has(rowKeyGetter(row)),
      isRowSelectionDisabled: isRowSelectionDisabled?.(row) === true,
    };
  }

  function renderDataRow(rowIdx: number, isOutsideViewport: boolean) {
    const row = rows[rowIdx];
    const { isRowSelected, isRowSelectionDisabled: rowDisabled } =
      getRowSelectionState(rowIdx);
    return (
      <Row
        key={rowKeyGetter(row)}
        row={row}
        rowIdx={rowIdx}
        gridRowStart={rowIdx + 2}
        iterateOverViewportColumnsForRow={iterateOverViewportColumnsForRow}
        activeCellIdx={rowIdx === activeRowIdx ? activePosition.idx : -1}
        isOutsideViewport={isOutsideViewport}
        isRowSelected={isRowSelected}
        isRowSelectionDisabled={rowDisabled}
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

  // The header contexts wrap only the HeaderRow; the row change context wraps
  // only data rows. Keeping the providers narrow means a header-state change
  // can't accidentally invalidate row consumers and vice-versa.
  const headerSection = (
    <HeaderRow
      iterateOverViewportColumnsForRow={iterateOverViewportColumnsForRow}
      activeCellIdx={activeIsHeader ? activePosition.idx : -1}
      shouldFocusGrid={!isActiveInBounds}
      setActivePosition={setActivePositionLatest}
      onColumnResize={handleColumnResize}
    />
  );

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      aria-multiselectable={isSelectable ? true : undefined}
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
      {isSelectable ? (
        <HeaderRowSelectionChangeContext.Provider value={selectHeaderRowLatest}>
          <HeaderRowSelectionContext.Provider value={headerSelectionValue}>
            {headerSection}
          </HeaderRowSelectionContext.Provider>
        </HeaderRowSelectionChangeContext.Provider>
      ) : (
        headerSection
      )}
      {isSelectable ? (
        <RowSelectionChangeContext.Provider value={selectRowLatest}>
          {viewportRows}
        </RowSelectionChangeContext.Provider>
      ) : (
        viewportRows
      )}
    </div>
  );
}

