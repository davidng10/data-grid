import { useCallback, useRef, useState, useTransition } from "react";

type CommitArgs<T> = {
  next: T;
  current: T;
  updateData: ((next: T) => void | Promise<void>) | undefined;
  // Fired synchronously when an async commit enters its pending state. Use
  // for cell-local UI that needs to display the in-flight value (e.g. the
  // SelectCell's pendingValue keeping the chosen option visible).
  onPending?: () => void;
  // Fired when an async commit settles, before the grid exits edit mode. Use
  // to clear any onPending side state.
  onSettled?: () => void;
};

/**
 * Shared commit lifecycle for grid-owned editor cells. The grid owns whether
 * a cell is in edit mode; this hook owns pending state and transition-wrapped
 * commits for the editor currently mounted in that cell.
 *
 * TODO: scroll-during-edit persists the draft. When the virtualizer drops the
 * row, the input's removal fires onBlur → commit(), which calls updateData
 * with the half-typed value. To discard instead, flip cancelledRef in a
 * useEffect cleanup in the consuming cell (TextCell/NumberCell).
 */
type Args = {
  closeEditor: () => void;
};

export const useCellEditor = ({ closeEditor }: Args) => {
  // Esc-cancel races with onBlur (the blur fires as a side effect of
  // unmounting the input). Without this flag, Esc would commit via the blur
  // path. Cells that commit on blur read this in their blur handler.
  const cancelledRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();
  const loading = pending || isPendingTransition;

  const cancelEdit = useCallback(() => {
    cancelledRef.current = true;
    closeEditor();
  }, [closeEditor]);

  const commit = useCallback(
    <T>({ next, current, updateData, onPending, onSettled }: CommitArgs<T>) => {
      if (loading) return;
      if (next === current) {
        closeEditor();
        return;
      }

      // Heavy parent setData (e.g. optimistic update of a large grid) goes
      // to the transition lane so the urgent setPending(true) below can
      // paint first — otherwise the spinner waits behind the data re-render.
      let result: void | Promise<void> | undefined;
      startTransition(() => {
        result = updateData?.(next);
      });

      if (result instanceof Promise) {
        setPending(true);
        onPending?.();
        result
          .catch(() => {
            // Parent owns revert; we just clear our pending state below.
          })
          .finally(() => {
            setPending(false);
            onSettled?.();
            closeEditor();
          });
      } else {
        closeEditor();
      }
    },
    [loading, closeEditor],
  );

  return {
    loading,
    pending,
    cancelledRef,
    cancelEdit,
    commit,
  };
};
