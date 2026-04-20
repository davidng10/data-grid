import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isPointInRange } from "../utils/rangeSelection";
import { shouldClearRangeForVisibilityChange } from "../utils/rangeVisibility";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import type {
  CellRange,
  CellRangeSelection,
  DataGridColumnDef,
  RangeCopyContext,
} from "../types";

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

  // Visible columns in current visual order. Used for arrow nav, Ctrl+A, and
  // the columns slice handed to onRangeCopy.
  visualColumnIds: string[];
  visibleColumns: DataGridColumnDef<TRow>[];

  rowCount: number;

  // Identity that flips on page / sort / filter / page-size change. Clears
  // the range and the focused cell when it flips.
  pageIdentity: unknown;

  getCellValue: (rowIndex: number, columnId: string) => unknown;

  onRangeContextMenu?: (e: globalThis.MouseEvent, range: CellRange) => void;
  onRangeCopy?: (
    range: CellRange,
    ctx: RangeCopyContext<TRow>,
  ) => string | null | void;
  onRangeSelectionChange?: (range: CellRangeSelection | null) => void;
};

// Digest of the current range, precomputed once per range change so body rows
// can read per-cell state in O(1). `null` when no range is active; body rows
// receive `null` rangeForRow and memo-bail on pointer compare.
export type RangeProjection = {
  rowMin: number;
  rowMax: number;
  anchorRowIndex: number;
  anchorColumnId: string;
  focusRowIndex: number;
  focusColumnId: string;
  inRangeColumnIds: Set<string>;
};

export type UseCellRangeSelectionResult = {
  rangeProjection: RangeProjection | null;
  clearRange: () => void;

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


function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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


export function useCellRangeSelection<TRow>(
  opts: UseCellRangeSelectionOptions<TRow>,
): UseCellRangeSelectionResult {
  const {
    enabled,
    bodyRef,
    visualColumnIds,
    visibleColumns,
    rowCount,
    pageIdentity,
    getCellValue,
    onRangeContextMenu,
    onRangeCopy,
    onRangeSelectionChange,
  } = opts;

  // Range is owned here. No external controlled prop — consumers observe via
  // onRangeContextMenu / onRangeCopy callbacks, or drive clear via the
  // imperative clearRange method below.
  const [cellRangeSelection, setCellRangeSelection] =
    useState<CellRangeSelection | null>(null);

  // focusedCell is a ref, not state: nothing outside the hook reads it, and
  // every arrow-key / mouseenter also dispatches setCellRangeSelection, which
  // re-renders. Holding focused as state would cause a redundant second
  // re-render with no visible effect.
  const focusedRef = useRef<FocusedCell>(null);

  // Mirror state/props to refs so the stable handlers below can read the
  // latest values without their identity changing on every render. Updates
  // happen in useLayoutEffect so the refs are current before any commit-phase
  // event handler fires.
  const isDraggingRef = useRef(false);
  const rangeRef = useRef<CellRangeSelection | null>(null);
  const visualIdsRef = useRef(visualColumnIds);
  const visibleColumnsRef = useRef(visibleColumns);
  const rowCountRef = useRef(rowCount);
  const enabledRef = useRef(enabled);
  const getCellValueRef = useRef(getCellValue);
  const onRangeContextMenuRef = useRef(onRangeContextMenu);
  const onRangeCopyRef = useRef(onRangeCopy);
  const onRangeSelectionChangeRef = useRef(onRangeSelectionChange);

  useLayoutEffect(() => {
    rangeRef.current = cellRangeSelection;
    visualIdsRef.current = visualColumnIds;
    visibleColumnsRef.current = visibleColumns;
    rowCountRef.current = rowCount;
    enabledRef.current = enabled;
    getCellValueRef.current = getCellValue;
    onRangeContextMenuRef.current = onRangeContextMenu;
    onRangeCopyRef.current = onRangeCopy;
    onRangeSelectionChangeRef.current = onRangeSelectionChange;
  });

  // Fire the observer callback after each range state change. Runs in an
  // effect (not a layout effect) so the DOM commit happens first — consumers
  // using the callback for live summaries, analytics, etc. should not block
  // the frame. Skip the mount-time fire since the initial `null` is a
  // starting state, not a change.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onRangeSelectionChangeRef.current?.(cellRangeSelection);
  }, [cellRangeSelection]);

  // Clear range + focused cell whenever page identity flips (pagination /
  // sort / filter / page-size). Replaces the external reducer's equivalent
  // clears — now owned here since range state is internal.
  useLayoutEffect(() => {
    setCellRangeSelection(null);
    focusedRef.current = null;
  }, [pageIdentity]);

  // Range visibility-change reconciliation: if the active range covers a
  // column that just became hidden, clear the range. Triggered only on
  // visualColumnIds changes; the range itself is read via ref so drag updates
  // don't re-run this effect.
  const lastVisualIdsRef = useRef(visualColumnIds);
  useEffect(() => {
    const prev = lastVisualIdsRef.current;
    lastVisualIdsRef.current = visualColumnIds;
    if (
      shouldClearRangeForVisibilityChange(
        prev,
        visualColumnIds,
        rangeRef.current,
      )
    ) {
      setCellRangeSelection(null);
    }
  }, [visualColumnIds]);

  const clearRange = useCallback(() => {
    setCellRangeSelection(null);
  }, []);

  // Digest the range into a shape body rows can use in O(1). Computed once
  // per range change — one visualColumnIds indexOf pair + a Set build. Body
  // rows slice this into per-row state; rows outside [rowMin, rowMax] receive
  // `null` and memo-bail.
  const rangeProjection = useMemo<RangeProjection | null>(() => {
    if (!cellRangeSelection) return null;
    const aColIdx = visualColumnIds.indexOf(cellRangeSelection.anchor.columnId);
    const fColIdx = visualColumnIds.indexOf(cellRangeSelection.focus.columnId);
    if (aColIdx < 0 || fColIdx < 0) return null;
    const cMin = Math.min(aColIdx, fColIdx);
    const cMax = Math.max(aColIdx, fColIdx);
    const inRangeColumnIds = new Set<string>();
    for (let i = cMin; i <= cMax; i++) {
      inRangeColumnIds.add(visualColumnIds[i]);
    }
    return {
      rowMin: Math.min(
        cellRangeSelection.anchor.rowIndex,
        cellRangeSelection.focus.rowIndex,
      ),
      rowMax: Math.max(
        cellRangeSelection.anchor.rowIndex,
        cellRangeSelection.focus.rowIndex,
      ),
      anchorRowIndex: cellRangeSelection.anchor.rowIndex,
      anchorColumnId: cellRangeSelection.anchor.columnId,
      focusRowIndex: cellRangeSelection.focus.rowIndex,
      focusColumnId: cellRangeSelection.focus.columnId,
      inRangeColumnIds,
    };
  }, [cellRangeSelection, visualColumnIds]);

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
        else if (cursor.y > rect.bottom - AUTO_SCROLL_GUTTER)
          dy = AUTO_SCROLL_SPEED;
        if (cursor.x < rect.left + AUTO_SCROLL_GUTTER) dx = -AUTO_SCROLL_SPEED;
        else if (cursor.x > rect.right - AUTO_SCROLL_GUTTER)
          dx = AUTO_SCROLL_SPEED;
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
          setCellRangeSelection(null);
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

  const setRange = setCellRangeSelection;

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
      focusedRef.current = point;

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
      const next = {
        anchor: current.anchor,
        focus: { rowIndex, columnId },
      };
      if (
        endpointsEqual(current.focus, next.focus) &&
        endpointsEqual(current.anchor, next.anchor)
      ) {
        return;
      }
      setRange(next);
      focusedRef.current = next.focus;
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
        focusedRef.current = point;
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
        const focus = {
          rowIndex: rc - 1,
          columnId: ids[ids.length - 1],
        };
        setRange({ anchor, focus });
        focusedRef.current = focus;
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
      focusedRef.current = nextPoint;
    },
    [setRange],
  );

  return useMemo(
    () => ({
      rangeProjection,
      clearRange,
      onCellMouseDown,
      onCellMouseEnter,
      onCellContextMenu,
      onBodyKeyDown,
    }),
    [
      rangeProjection,
      clearRange,
      onCellMouseDown,
      onCellMouseEnter,
      onCellContextMenu,
      onBodyKeyDown,
    ],
  );
}
