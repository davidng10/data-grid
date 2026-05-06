import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type CommitArgs<T> = {
  next: T;
  current: T;
  updateData: ((next: T) => void | Promise<void>) | undefined;
  // Fired synchronously when an async commit enters its pending state. Use
  // for cell-local UI that needs to display the in-flight value (e.g. the
  // SelectCell's pendingValue keeping the chosen option visible).
  onPending?: () => void;
  // Fired (inside a transition) when an async commit settles, before
  // setEditing(false). Use to clear any onPending side state.
  onSettled?: () => void;
};

/**
 * Shared edit-state machine for editor cells. Owns the editing/pending flags,
 * the unmount cleanup that lets the virtualizer drop a row safely, and the
 * commit lifecycle (sync vs async, transition wrapping, dead-fiber guard).
 */
export const useCellEditor = () => {
  // Esc-cancel races with onBlur (the blur fires as a side effect of
  // unmounting the input). Without this flag, Esc would commit via the blur
  // path. Cells that commit on blur read this in their blur handler.
  const cancelledRef = useRef(false);
  const isMountedRef = useRef(true);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();
  const loading = pending || isPendingTransition;

  // Virtualizer drops rows that scroll out of the overscan window. On unmount,
  // suppress any blur-fired commit during teardown (discard the draft) and
  // mark the cell as dead so an in-flight commit's .finally is a no-op.
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelledRef.current = true;
    };
  }, []);

  const beginEdit = useCallback(() => {
    cancelledRef.current = false;
    setEditing(true);
  }, []);

  const cancelEdit = useCallback(() => {
    cancelledRef.current = true;
    setEditing(false);
  }, []);

  const commit = useCallback(
    <T,>({ next, current, updateData, onPending, onSettled }: CommitArgs<T>) => {
      if (loading) return;
      if (next === current) {
        setEditing(false);
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
            // Cell unmounted while the commit was in flight — drop the
            // closure refs to setEditing/setPending without firing
            // dead-fiber updates.
            if (!isMountedRef.current) return;
            startTransition(() => {
              setEditing(false);
              setPending(false);
              onSettled?.();
            });
          });
      } else {
        startTransition(() => {
          setEditing(false);
        });
      }
    },
    [loading],
  );

  return { editing, loading, pending, cancelledRef, beginEdit, cancelEdit, commit };
};
