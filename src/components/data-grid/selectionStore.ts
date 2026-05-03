export type ActiveCell = { row: number; col: number } | null;

export type SelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ActiveCell;
  setActive: (row: number, col: number) => void;
  moveBy: (
    dr: number,
    dc: number,
    bounds: { rowCount: number; colCount: number },
  ) => void;
  clear: () => void;
};

export const createSelectionStore = (): SelectionStore => {
  let state: ActiveCell = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of listeners) l();
  };

  const set = (next: ActiveCell) => {
    if (
      state === next ||
      (state &&
        next &&
        state.row === next.row &&
        state.col === next.col)
    ) {
      return;
    }
    state = next;
    emit();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    setActive: (row, col) => set({ row, col }),
    moveBy: (dr, dc, { rowCount, colCount }) => {
      if (!state) {
        if (rowCount > 0 && colCount > 0) set({ row: 0, col: 0 });
        return;
      }
      const row = Math.max(0, Math.min(rowCount - 1, state.row + dr));
      const col = Math.max(0, Math.min(colCount - 1, state.col + dc));
      set({ row, col });
    },
    clear: () => set(null),
  };
};
