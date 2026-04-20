import { useCallback, useMemo, useReducer } from "react";

import type { OnChangeFn } from "@tanstack/react-table";
import type { ActiveEditorState } from "../types";

// Transient state the grid owns end-to-end (not controlled by the caller).
// `view` and `columnConfig` are deliberately excluded — they stay caller-owned
// so URL / localStorage / server persistence strategies remain pluggable.
// `cellRangeSelection` is also excluded — it's owned inside DataGrid itself
// (cleared imperatively via the DataGridHandle), not routed through here.
export type DataGridTransitionsState = {
  rowSelection: Record<string, boolean>;
  activeEditor: ActiveEditorState;
};

type Updater<T> = T | ((old: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function"
    ? (updater as (old: T) => T)(prev)
    : updater;
}

type Action =
  // Semantic transitions — the reducer owns the "what clears on what" contract
  // documented in the DataGrid README transition table.
  | { type: "pageChanged" }
  | { type: "sortChanged" }
  | { type: "filtersChanged" }
  // Direct setters — shaped as TanStack-style updaters so they compose with
  // the OnChangeFn callbacks the grid already uses.
  | { type: "rowSelectionSet"; updater: Updater<Record<string, boolean>> }
  | { type: "activeEditorSet"; updater: Updater<ActiveEditorState> };

const INITIAL_STATE: DataGridTransitionsState = {
  rowSelection: {},
  activeEditor: null,
};

function reducer(
  state: DataGridTransitionsState,
  action: Action,
): DataGridTransitionsState {
  switch (action.type) {
    case "pageChanged":
      return state;

    case "sortChanged":
    case "filtersChanged": {
      const hasRowSel = Object.keys(state.rowSelection).length > 0;
      if (!hasRowSel) return state;
      return { ...state, rowSelection: {} };
    }

    case "rowSelectionSet": {
      const next = resolveUpdater(action.updater, state.rowSelection);
      if (next === state.rowSelection) return state;
      return { ...state, rowSelection: next };
    }

    case "activeEditorSet": {
      const next = resolveUpdater(action.updater, state.activeEditor);
      if (next === state.activeEditor) return state;
      return { ...state, activeEditor: next };
    }
  }
}

export type DataGridTransitionsActions = {
  // Semantic transitions called from useDataGrid's setters.
  pageChanged: () => void;
  sortChanged: () => void;
  filtersChanged: () => void;
  // OnChangeFn-shaped — safe to hand directly to TanStack / DataGrid as the
  // matching on*Change prop.
  setRowSelection: OnChangeFn<Record<string, boolean>>;
  setActiveEditor: OnChangeFn<ActiveEditorState>;
};

export type UseDataGridTransitionsResult = {
  state: DataGridTransitionsState;
  actions: DataGridTransitionsActions;
};

export function useDataGridTransitions(): UseDataGridTransitionsResult {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // dispatch is stable by React guarantee — empty deps are correct here.
  const pageChanged = useCallback(() => dispatch({ type: "pageChanged" }), []);
  const sortChanged = useCallback(() => dispatch({ type: "sortChanged" }), []);
  const filtersChanged = useCallback(
    () => dispatch({ type: "filtersChanged" }),
    [],
  );
  const setRowSelection = useCallback<OnChangeFn<Record<string, boolean>>>(
    (updater) => dispatch({ type: "rowSelectionSet", updater }),
    [],
  );
  const setActiveEditor = useCallback<OnChangeFn<ActiveEditorState>>(
    (updater) => dispatch({ type: "activeEditorSet", updater }),
    [],
  );

  const actions = useMemo<DataGridTransitionsActions>(
    () => ({
      pageChanged,
      sortChanged,
      filtersChanged,
      setRowSelection,
      setActiveEditor,
    }),
    [
      pageChanged,
      sortChanged,
      filtersChanged,
      setRowSelection,
      setActiveEditor,
    ],
  );

  return { state, actions };
}
