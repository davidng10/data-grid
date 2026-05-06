import { useMemo, useSyncExternalStore } from "react";
import { createGridSelectionStore, type GridSelectionStore } from "./gridSelectionStore";

export const useGridSelection = (): GridSelectionStore => {
  // One store per grid instance, kept stable across renders.
  return useMemo(() => createGridSelectionStore(), []);
};

/**
 * Per-cell subscription. When the active cell changes, exactly two cells
 * re-render (the one losing active state, the one gaining it) — every other
 * cell sees the same boolean and bails via React's bailout.
 */
export const useIsActiveCell = (
  store: GridSelectionStore,
  row: number,
  col: number,
): boolean => {
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const s = store.getSnapshot();
      return s !== null && s.row === row && s.col === col;
    },
  );
};
