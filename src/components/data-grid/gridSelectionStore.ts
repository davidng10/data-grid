export type ActiveCellMode = "view" | "edit";
export type ActiveCell = {
  rowId: string;
  columnId: string;
  mode: ActiveCellMode;
} | null;

export type GridSelectionStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ActiveCell;
  setActive: (rowId: string, columnId: string) => void;
  setEditing: (rowId: string, columnId: string) => void;
  clear: () => void;
};

export const createGridSelectionStore = (): GridSelectionStore => {
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
        state.rowId === next.rowId &&
        state.columnId === next.columnId &&
        state.mode === next.mode)
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
    setActive: (rowId, columnId) => set({ rowId, columnId, mode: "view" }),
    setEditing: (rowId, columnId) => set({ rowId, columnId, mode: "edit" }),
    clear: () => set(null),
  };
};
