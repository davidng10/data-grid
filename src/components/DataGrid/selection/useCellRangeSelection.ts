import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import type {
  CellRange,
  CellRangeSelection,
  DataGridColumnDef,
  RangeCopyContext,
} from "../DataGrid.types";

type FocusedCell = { rowIndex: number; columnId: string } | null;

// Inner gutter (px) at each viewport edge that triggers auto-scroll while
// dragging. 24px is comfortable enough that the cursor doesn't need to leave
// the viewport to trigger scroll (browsers stop firing mouseenter on
// off-screen elements).
const AUTO_SCROLL_GUTTER = 24;
const AUTO_SCROLL_SPEED = 8; // px per frame

type UseCellRangeSelectionOptions<TRow> = {
  enabled: boolean;
  bodyRef: RefObject<HTMLDivElement | null>;

  cellRangeSelection: CellRangeSelection | null;
  onCellRangeSelectionChange?: (next: CellRangeSelection | null) => void;

  // Visible columns in current visual order. Used for arrow nav, Ctrl+A, and
  // the columns slice handed to onRangeCopy.
  visualColumnIds: string[];
  visibleColumns: DataGridColumnDef<TRow>[];

  rowCount: number;

  // Identity that flips on page / sort / filter / page-size change. Drives
  // focused-cell reset.
  pageIdentity: unknown;

  getCellValue: (rowIndex: number, columnId: string) => unknown;

  onRangeContextMenu?: (e: globalThis.MouseEvent, range: CellRange) => void;
  onRangeCopy?: (
    range: CellRange,
    ctx: RangeCopyContext<TRow>,
  ) => string | null | void;
};

export type UseCellRangeSelectionResult = {
  focusedCell: FocusedCell;

  onCellMouseDown: (
    rowIndex: number,
    columnId: string,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => void;
  onCellMouseEnter: (rowIndex: number, columnId: string) => void;
  onCellContextMenu: (
    rowIndex: number,
    columnId: string,
    e: ReactMouseEvent<HTMLDivElement>,
  ) => void;
  onBodyKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
};

function endpointsEqual(
  a: { rowIndex: number; columnId: string },
  b: { rowIndex: number; columnId: string },
): boolean {
  return a.rowIndex === b.rowIndex && a.columnId === b.columnId;
}

export function useCellRangeSelection<TRow>(
  opts: UseCellRangeSelectionOptions<TRow>,
): UseCellRangeSelectionResult {
  const {
    enabled,
    bodyRef,
    cellRangeSelection,
    onCellRangeSelectionChange,
    visualColumnIds,
    visibleColumns,
    rowCount,
    pageIdentity,
    getCellValue,
    onRangeContextMenu,
    onRangeCopy,
  } = opts;

  const [focusedCell, setFocusedCell] = useState<FocusedCell>(null);

  // Mirror props/state to refs so the stable handlers below can read the
  // latest values without their identity changing on every render. Updates
  // happen in useLayoutEffect so the refs are current before any commit-phase
  // event handler fires.
  const isDraggingRef = useRef(false);
  const rangeRef = useRef(cellRangeSelection);
  const focusedRef = useRef(focusedCell);
  const visualIdsRef = useRef(visualColumnIds);
  const visibleColumnsRef = useRef(visibleColumns);
  const rowCountRef = useRef(rowCount);
  const enabledRef = useRef(enabled);
  const getCellValueRef = useRef(getCellValue);
  const onCellRangeSelectionChangeRef = useRef(onCellRangeSelectionChange);
  const onRangeContextMenuRef = useRef(onRangeContextMenu);
  const onRangeCopyRef = useRef(onRangeCopy);

  useLayoutEffect(() => {
    rangeRef.current = cellRangeSelection;
    focusedRef.current = focusedCell;
    visualIdsRef.current = visualColumnIds;
    visibleColumnsRef.current = visibleColumns;
    rowCountRef.current = rowCount;
    enabledRef.current = enabled;
    getCellValueRef.current = getCellValue;
    onCellRangeSelectionChangeRef.current = onCellRangeSelectionChange;
    onRangeContextMenuRef.current = onRangeContextMenu;
    onRangeCopyRef.current = onRangeCopy;
  });

  // Clear focused cell when the page identity changes. Uses the
  // "store-prev-prop" pattern (React docs: "Adjusting state when a prop
  // changes") rather than useEffect — avoids the cascading-render lint rule
  // and resets in the same render pass instead of one frame later.
  const [prevPageIdentity, setPrevPageIdentity] = useState(pageIdentity);
  if (prevPageIdentity !== pageIdentity) {
    setPrevPageIdentity(pageIdentity);
    setFocusedCell(null);
  }

  // Auto-scroll loop while dragging. Reads cursor position from a ref written
  // by the document-level mousemove listener (registered on drag start).
  const autoScrollFrameRef = useRef<number | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  // Inner self-recursive tick — declared as a closure so we can pass it to
  // requestAnimationFrame without forward-referencing the outer callback.
  const startAutoScroll = useCallback(() => {
    const tick = () => {
      if (!isDraggingRef.current) {
        autoScrollFrameRef.current = null;
        return;
      }
      const el = bodyRef.current;
      const cursor = cursorRef.current;
      if (el && cursor) {
        const rect = el.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (cursor.y < rect.top + AUTO_SCROLL_GUTTER) dy = -AUTO_SCROLL_SPEED;
        else if (cursor.y > rect.bottom - AUTO_SCROLL_GUTTER) dy = AUTO_SCROLL_SPEED;
        if (cursor.x < rect.left + AUTO_SCROLL_GUTTER) dx = -AUTO_SCROLL_SPEED;
        else if (cursor.x > rect.right - AUTO_SCROLL_GUTTER) dx = AUTO_SCROLL_SPEED;
        if (dx !== 0 || dy !== 0) {
          el.scrollLeft += dx;
          el.scrollTop += dy;
        }
      }
      autoScrollFrameRef.current = requestAnimationFrame(tick);
    };
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(tick);
    }
  }, [bodyRef]);

  // Document-level listeners. Mouseup ends drag + cancels auto-scroll.
  // Mousedown outside the body clears the range. Mousemove tracks cursor
  // for the auto-scroll loop while dragging.
  useEffect(() => {
    if (!enabled) return;

    const onDocMouseMove = (e: globalThis.MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    const onDocMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        stopAutoScroll();
        cursorRef.current = null;
      }
    };
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      if (e.button !== 0) return;
      const el = bodyRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        if (rangeRef.current !== null) {
          onCellRangeSelectionChangeRef.current?.(null);
        }
      }
    };

    document.addEventListener("mouseup", onDocMouseUp);
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("mousemove", onDocMouseMove);

    return () => {
      document.removeEventListener("mouseup", onDocMouseUp);
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("mousemove", onDocMouseMove);
      stopAutoScroll();
    };
  }, [enabled, bodyRef, stopAutoScroll]);

  const setRange = useCallback((next: CellRangeSelection | null) => {
    onCellRangeSelectionChangeRef.current?.(next);
  }, []);

  const onCellMouseDown = useCallback(
    (
      rowIndex: number,
      columnId: string,
      e: ReactMouseEvent<HTMLDivElement>,
    ) => {
      if (!enabledRef.current) return;
      if (e.button !== 0) return;
      // Suppress native text-selection drag inside the grid body.
      e.preventDefault();

      const point = { rowIndex, columnId };
      const current = rangeRef.current;
      if (e.shiftKey && current) {
        setRange({ anchor: current.anchor, focus: point });
      } else {
        setRange({ anchor: point, focus: point });
      }
      setFocusedCell(point);

      isDraggingRef.current = true;
      cursorRef.current = { x: e.clientX, y: e.clientY };
      startAutoScroll();
    },
    [setRange, startAutoScroll],
  );

  const onCellMouseEnter = useCallback(
    (rowIndex: number, columnId: string) => {
      if (!enabledRef.current) return;
      if (!isDraggingRef.current) return;
      const current = rangeRef.current;
      if (!current) return;
      const next = { anchor: current.anchor, focus: { rowIndex, columnId } };
      if (
        endpointsEqual(current.focus, next.focus) &&
        endpointsEqual(current.anchor, next.anchor)
      ) {
        return;
      }
      setRange(next);
      setFocusedCell(next.focus);
    },
    [setRange],
  );

  const onCellContextMenu = useCallback(
    (
      rowIndex: number,
      columnId: string,
      e: ReactMouseEvent<HTMLDivElement>,
    ) => {
      if (!enabledRef.current) return;
      if (!onRangeContextMenuRef.current) return;
      const current = rangeRef.current;
      const inside = current
        ? isPointInRange(rowIndex, columnId, current, visualIdsRef.current)
        : false;

      let nextRange: CellRange;
      if (inside && current) {
        nextRange = current;
      } else {
        const point = { rowIndex, columnId };
        nextRange = { anchor: point, focus: point };
        setRange(nextRange);
        setFocusedCell(point);
      }
      e.preventDefault();
      onRangeContextMenuRef.current(e.nativeEvent, nextRange);
    },
    [setRange],
  );

  const onBodyKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!enabledRef.current) return;
      const isMod = e.ctrlKey || e.metaKey;

      // Ctrl+A: works regardless of focus. Selects all visible cells on the
      // current page; sets focused cell to bottom-right of the new range.
      if (isMod && e.key.toLowerCase() === "a") {
        const ids = visualIdsRef.current;
        const rc = rowCountRef.current;
        if (ids.length === 0 || rc === 0) return;
        e.preventDefault();
        const anchor = { rowIndex: 0, columnId: ids[0] };
        const focus = { rowIndex: rc - 1, columnId: ids[ids.length - 1] };
        setRange({ anchor, focus });
        setFocusedCell(focus);
        return;
      }

      // Everything below requires a focused cell. If none, return without
      // preventDefault so the browser handles the key (arrow → page scroll).
      const focused = focusedRef.current;
      if (!focused) return;

      const ids = visualIdsRef.current;
      const colIdx = ids.indexOf(focused.columnId);
      if (colIdx < 0) return; // focused column was hidden; treat as no-op

      // Ctrl+C: fire onRangeCopy if provided.
      if (isMod && e.key.toLowerCase() === "c") {
        const cb = onRangeCopyRef.current;
        if (!cb) return;
        e.preventDefault();
        const range: CellRange = rangeRef.current ?? {
          anchor: focused,
          focus: focused,
        };
        const slice = sliceColumns(visibleColumnsRef.current, ids, range);
        const result = cb(range, {
          getCellValue: getCellValueRef.current,
          columns: slice,
        });
        if (typeof result === "string" && navigator.clipboard) {
          // Fire-and-forget. If the user copies again before this resolves,
          // the next call wins as it should.
          void navigator.clipboard.writeText(result);
        }
        return;
      }

      if (e.key === "Escape") {
        if (rangeRef.current !== null) {
          e.preventDefault();
          setRange(null);
        }
        return;
      }

      let dRow = 0;
      let dCol = 0;
      switch (e.key) {
        case "ArrowUp":
          dRow = -1;
          break;
        case "ArrowDown":
          dRow = 1;
          break;
        case "ArrowLeft":
          dCol = -1;
          break;
        case "ArrowRight":
          dCol = 1;
          break;
        default:
          return;
      }

      const rc = rowCountRef.current;
      const referenceRow = e.shiftKey
        ? (rangeRef.current?.focus.rowIndex ?? focused.rowIndex)
        : focused.rowIndex;
      const referenceColIdx = e.shiftKey
        ? ids.indexOf(rangeRef.current?.focus.columnId ?? focused.columnId)
        : colIdx;

      const nextRow = clamp(referenceRow + dRow, 0, rc - 1);
      const nextColIdx = clamp(
        (referenceColIdx >= 0 ? referenceColIdx : colIdx) + dCol,
        0,
        ids.length - 1,
      );
      const nextPoint = { rowIndex: nextRow, columnId: ids[nextColIdx] };

      e.preventDefault();
      if (e.shiftKey) {
        const anchor = rangeRef.current?.anchor ?? focused;
        setRange({ anchor, focus: nextPoint });
      } else {
        setRange({ anchor: nextPoint, focus: nextPoint });
      }
      setFocusedCell(nextPoint);
    },
    [setRange],
  );

  return useMemo(
    () => ({
      focusedCell,
      onCellMouseDown,
      onCellMouseEnter,
      onCellContextMenu,
      onBodyKeyDown,
    }),
    [
      focusedCell,
      onCellMouseDown,
      onCellMouseEnter,
      onCellContextMenu,
      onBodyKeyDown,
    ],
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isPointInRange(
  rowIndex: number,
  columnId: string,
  range: CellRangeSelection,
  visualIds: string[],
): boolean {
  const rMin = Math.min(range.anchor.rowIndex, range.focus.rowIndex);
  const rMax = Math.max(range.anchor.rowIndex, range.focus.rowIndex);
  if (rowIndex < rMin || rowIndex > rMax) return false;
  const aIdx = visualIds.indexOf(range.anchor.columnId);
  const fIdx = visualIds.indexOf(range.focus.columnId);
  const cIdx = visualIds.indexOf(columnId);
  if (aIdx < 0 || fIdx < 0 || cIdx < 0) return false;
  const cMin = Math.min(aIdx, fIdx);
  const cMax = Math.max(aIdx, fIdx);
  return cIdx >= cMin && cIdx <= cMax;
}

function sliceColumns<TRow>(
  visibleColumns: DataGridColumnDef<TRow>[],
  visualIds: string[],
  range: CellRangeSelection,
): DataGridColumnDef<TRow>[] {
  const aIdx = visualIds.indexOf(range.anchor.columnId);
  const fIdx = visualIds.indexOf(range.focus.columnId);
  if (aIdx < 0 || fIdx < 0) return [];
  const cMin = Math.min(aIdx, fIdx);
  const cMax = Math.max(aIdx, fIdx);
  const sliceIds = visualIds.slice(cMin, cMax + 1);
  const byId = new Map(visibleColumns.map((c) => [c.id, c]));
  return sliceIds
    .map((id) => byId.get(id))
    .filter((c): c is DataGridColumnDef<TRow> => c !== undefined);
}

export function isCellInRange(
  rowIndex: number,
  columnId: string,
  range: CellRangeSelection | null,
  visualIds: string[],
): boolean {
  if (!range) return false;
  return isPointInRange(rowIndex, columnId, range, visualIds);
}
