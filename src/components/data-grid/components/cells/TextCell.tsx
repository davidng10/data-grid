import { LoadingOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CellContext } from "@tanstack/react-table";

type TextCellProps<TData> = {
  info: CellContext<TData, unknown>;
  editable?: boolean;
};

/**
 * TextCell uses input for handling edits
 * because it has no overheads compared to using a component library.
 */
export const TextCell = <TData,>({ info, editable }: TextCellProps<TData>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const cancelledRef = useRef(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  const [isPendingTransition, startTransition] = useTransition();

  const value = String(info.getValue() ?? "");
  const loading = pending || isPendingTransition;
  // Esc-cancel races with onBlur (the blur fires as a side effect of unmounting
  // the input). Without this flag, Esc would commit via the blur path.

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }
  }, [editing]);

  const handleEnableEditing = () => {
    if (loading) return;
    cancelledRef.current = false;
    setDraft(value);
    setEditing(true);
  };

  if (!editable) return <>{value}</>;

  if (!editing) {
    return (
      <div className="dg-cell-display" onDoubleClick={handleEnableEditing}>
        {value}
      </div>
    );
  }

  const commit = () => {
    if (loading) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    const updateData = info.table.options.meta?.updateData;

    // Heavy setData (parent's optimistic update of a large grid) goes to the
    // transition lane so the urgent setPending(true) below can paint first —
    // otherwise the spinner waits ~500ms behind the data re-render.
    // startTransition runs the callback synchronously, so `result` is captured
    // immediately even though state updates inside are deferred.
    startTransition(() => {
      const r = updateData?.(info.row.index, info.column.id, draft);
      if (r instanceof Promise) {
        setPending(true);
        r.catch(() => {
          // Parent owns revert; we just clear our pending state below.
        }).finally(() => {
          // Cleanup goes through a transition too so it batches with any
          // still-uncommitted data render — display mode never reads the
          // stale value, so no flicker on exit.
          setEditing(false);
          setPending(false);
        });
      } else {
        setEditing(false);
      }
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        className="dg-cell-input"
        value={draft}
        disabled={loading}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelledRef.current) {
            cancelledRef.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelledRef.current = true;
            setEditing(false);
          }
        }}
      />
      {loading && <LoadingOutlined className="dg-cell-input-suffix" />}
    </>
  );
};
