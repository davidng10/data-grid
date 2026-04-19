import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

type UseRowSelectionOptions = {
  enabled: boolean;
  // Row ids on the current page, in render order. Used for shift-click range
  // resolution and the header tri-state.
  pageRowIds: string[];
  rowSelection: Record<string, boolean>;
  onRowSelectionChange?: (next: Record<string, boolean>) => void;
  // Identity that flips on page / sort / filter changes — clears the
  // shift-click anchor so it can't accidentally reach across pages.
  pageIdentity: unknown;
};

export type RowSelectionHeaderState = "all" | "some" | "none";

export type UseRowSelectionResult = {
  toggleRow: (rowIndex: number, rowId: string, shiftKey: boolean) => void;
  toggleAll: () => void;
  headerState: RowSelectionHeaderState;
};

export function useRowSelection(
  opts: UseRowSelectionOptions,
): UseRowSelectionResult {
  const {
    enabled,
    pageRowIds,
    rowSelection,
    onRowSelectionChange,
    pageIdentity,
  } = opts;

  const anchorRef = useRef<number | null>(null);
  const rowSelectionRef = useRef(rowSelection);
  const pageRowIdsRef = useRef(pageRowIds);
  const onChangeRef = useRef(onRowSelectionChange);
  // useLayoutEffect (not assignment-during-render) keeps refs lint-clean and
  // ensures they're updated before any commit-phase event handler fires.
  useLayoutEffect(() => {
    rowSelectionRef.current = rowSelection;
    pageRowIdsRef.current = pageRowIds;
    onChangeRef.current = onRowSelectionChange;
  });

  // Reset shift-click anchor on page-identity change. useLayoutEffect rather
  // than setting the ref during render — refs can't be mutated in render
  // without tripping the lint rule. The one-frame delay is irrelevant: the
  // anchor is only consulted on the next checkbox click.
  useLayoutEffect(() => {
    anchorRef.current = null;
  }, [pageIdentity]);

  const toggleRow = useCallback(
    (rowIndex: number, rowId: string, shiftKey: boolean) => {
      if (!enabled) return;
      const setter = onChangeRef.current;
      if (!setter) return;
      const ids = pageRowIdsRef.current;
      const current = rowSelectionRef.current;

      if (shiftKey && anchorRef.current !== null) {
        const from = Math.min(anchorRef.current, rowIndex);
        const to = Math.max(anchorRef.current, rowIndex);
        // The "value" for the range is the inverse of the anchor row's current
        // selection state — matches Excel/Google Sheets shift-click behavior:
        // if the anchor was unselected, shift-click selects the range; if it
        // was selected, shift-click deselects the range.
        const anchorId = ids[anchorRef.current];
        const value = !current[anchorId];
        const next = { ...current };
        for (let i = from; i <= to; i++) {
          const id = ids[i];
          if (!id) continue;
          if (value) next[id] = true;
          else delete next[id];
        }
        setter(next);
        // Anchor stays put — successive shift-clicks expand/contract from the
        // same anchor (matches Excel).
        return;
      }

      const next = { ...current };
      if (next[rowId]) {
        delete next[rowId];
      } else {
        next[rowId] = true;
      }
      setter(next);
      anchorRef.current = rowIndex;
    },
    [enabled],
  );

  const headerState: RowSelectionHeaderState = useMemo(() => {
    if (pageRowIds.length === 0) return "none";
    let selectedOnPage = 0;
    for (const id of pageRowIds) {
      if (rowSelection[id]) selectedOnPage++;
    }
    if (selectedOnPage === 0) return "none";
    if (selectedOnPage === pageRowIds.length) return "all";
    return "some";
  }, [pageRowIds, rowSelection]);

  const toggleAll = useCallback(() => {
    if (!enabled) return;
    const setter = onChangeRef.current;
    if (!setter) return;
    const ids = pageRowIdsRef.current;
    const current = rowSelectionRef.current;
    let allSelected = ids.length > 0;
    for (const id of ids) {
      if (!current[id]) {
        allSelected = false;
        break;
      }
    }
    const next = { ...current };
    if (allSelected) {
      for (const id of ids) delete next[id];
    } else {
      for (const id of ids) next[id] = true;
    }
    setter(next);
    anchorRef.current = null;
  }, [enabled]);

  return useMemo(
    () => ({ toggleRow, toggleAll, headerState }),
    [toggleRow, toggleAll, headerState],
  );
}
